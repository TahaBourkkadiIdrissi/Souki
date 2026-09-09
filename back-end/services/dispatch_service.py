import logging
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from config import LocalSession, SOUKI_DEPOT_LAT, SOUKI_DEPOT_LNG
from operating_mode import suppliers_enabled, depot_identity
from entities.anomalie_entity import AnomalieLogistique
from entities.commande_entity import Commande
from entities.fournisseur_entity import Fournisseur
from entities.ligne_panier_entity import LignePanier
from entities.livreur_entity import Livreur
from entities.panier_entity import Panier
from interfaces.commande_dao_interface import ICommandeVocaleDao
from interfaces.dispatch_service_interface import IDispatchService
from interfaces.livreur_dao_interface import ILivreurDao
from interfaces.tournee_dao_interface import ITourneeDao
from services.commande_state_machine import (
    CommandeTransitionError,
    changer_statut,
    process_end_of_day_returns,
)
from services.date_utils import today_morocco
from services.notification_service import notification_service
from services.zone_resolver import haversine


DISPATCH_TARGET_STATUS = "EN_ATTENTE_LIVREUR"
LOCKED_DISPATCH_STATUS = "VERROUILLEE"
# Garde-fou metier (BUG-004) : seules les commandes validees par le JIT (VERROUILLEE)
# ou en reprise apres refus livreur peuvent entrer dans une tournee. Les statuts
# EN_ATTENTE et CONFIRMEE ne sont PAS dispatchables.
DISPATCH_STATUS_PROGRESSIONS = {
    "VERROUILLEE": (DISPATCH_TARGET_STATUS,),
    "REFUS_LIVREUR": (DISPATCH_TARGET_STATUS,),
}
REASSIGNABLE_COMMANDE_STATUSES = {"EN_ATTENTE_LIVREUR", "A_LIVRER", "PLANIFIEE"}


logger = logging.getLogger(__name__)


class DispatchServiceError(ValueError):
    status_code = 400


class DispatchNoLivreurError(DispatchServiceError):
    status_code = 400


class DispatchNotFoundError(DispatchServiceError):
    status_code = 404


class DispatchService(IDispatchService):

    def __init__(
        self,
        commande_dao: ICommandeVocaleDao,
        livreur_dao: ILivreurDao,
        tournee_dao: ITourneeDao,
        session: Optional[Session] = None,
    ) -> None:
        self.commande_dao = commande_dao
        self.livreur_dao = livreur_dao
        self.tournee_dao = tournee_dao
        self.session = session
        self._owns_session = False

    def _ensure_session(self) -> Session:
        if self.session is None:
            self.session = LocalSession()
            self._owns_session = True
        return self.session

    def _close_owned_session(self, rollback: bool = False) -> None:
        if self.session and self._owns_session:
            if rollback:
                self.session.rollback()
            self.session.close()
            self.session = None
            self._owns_session = False

    def __enter__(self):
        self._ensure_session()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._close_owned_session(rollback=exc_type is not None)

    def generate_daily_routes(
        self,
        target_date: date,
        excluded_livreur_ids: Optional[set[int]] = None,
        commande_ids: Optional[set[int]] = None,
    ) -> dict[str, Any]:
        session = self._ensure_session()
        transaction = session.begin_nested() if session.in_transaction() else session.begin()
        excluded_ids = {int(livreur_id) for livreur_id in (excluded_livreur_ids or set())}

        try:
            with transaction:
                retours_depot = process_end_of_day_returns(session, target_date)
                commandes = self.commande_dao.get_commandes_non_assignees(
                    session,
                    commande_ids=commande_ids,
                    statuts={LOCKED_DISPATCH_STATUS},
                )
                # Filtre critique: le dispatch quotidien n'assigne que les commandes verrouillees par le JIT.
                commandes = [
                    commande
                    for commande in commandes
                    if self._is_commande_locked_for_dispatch(commande)
                ]
                commandes_sans_fournisseur = [
                    int(commande.id)
                    for commande in commandes
                    if suppliers_enabled() and commande.fournisseur_id is None
                ]
                commandes_par_fournisseur: dict[int | None, list[Commande]] = defaultdict(list)
                for commande in commandes:
                    if not suppliers_enabled():
                        # None is the Souki pickup group, never a synthetic supplier ID.
                        commandes_par_fournisseur[None].append(commande)
                    elif commande.fournisseur_id is not None:
                        commandes_par_fournisseur[int(commande.fournisseur_id)].append(commande)

                if not commandes:
                    return {
                        "status": "no_orders",
                        "target_date": target_date.isoformat(),
                        "count": 0,
                        "tournees_created": 0,
                        "commandes_assigned": 0,
                        "commandes_sans_fournisseur": 0,
                        "fournisseurs_sans_livreur": [],
                        "retours_depot": retours_depot,
                    }

                livreurs = [
                    livreur
                    for livreur in self.livreur_dao.get_available_livreurs(session)
                    if int(livreur.user_id) not in excluded_ids
                ]
                allocations, fournisseurs_sans_livreur = self._allocate_livreurs_by_supplier(
                    commandes_par_fournisseur,
                    livreurs,
                )

                tournees_created = 0
                commandes_assigned = 0
                commandes_backlog_coordonnees = 0

                for fournisseur_id, commandes_fournisseur in sorted(
                    commandes_par_fournisseur.items(),
                    key=lambda item: (-len(item[1]), item[0]),
                ):
                    livreurs_alloues = allocations.get(fournisseur_id, [])
                    if not livreurs_alloues:
                        continue

                    if not suppliers_enabled():
                        pickup_lat = float(SOUKI_DEPOT_LAT)
                        pickup_lng = float(SOUKI_DEPOT_LNG)
                    else:
                        fournisseur = session.get(Fournisseur, fournisseur_id)
                        if (
                            fournisseur is None
                            or fournisseur.latitude is None
                            or fournisseur.longitude is None
                        ):
                            logger.error(
                                "Dispatch ignore fournisseur_id=%s: coordonnées de ramassage absentes.",
                                fournisseur_id,
                            )
                            commandes_backlog_coordonnees += len(commandes_fournisseur)
                            continue

                        pickup_lat = float(fournisseur.latitude)
                        pickup_lng = float(fournisseur.longitude)
                    commandes_triees = self._sort_commandes_from_pickup(
                        commandes_fournisseur,
                        pickup_lat=pickup_lat,
                        pickup_lng=pickup_lng,
                    )
                    chunks = self._split_equally(commandes_triees, len(livreurs_alloues))

                    for livreur, commandes_chunk in zip(livreurs_alloues, chunks):
                        if not commandes_chunk:
                            continue

                        tournee = self.tournee_dao.create_tournee(
                            session,
                            livreur_id=int(livreur.user_id),
                            date_tournee=target_date,
                            fournisseur_id=fournisseur_id,
                            pickup_lat=pickup_lat,
                            pickup_lng=pickup_lng,
                        )
                        tournees_created += 1

                        for index, commande in enumerate(commandes_chunk, start=1):
                            commande.tournee_id = int(tournee.id)
                            commande.livreur_id = int(livreur.user_id)
                            commande.ordre_passage = index
                            self._mettre_commande_en_attente_livreur(
                                session=session,
                                commande=commande,
                                actor_id=int(livreur.user_id),
                            )
                            commandes_assigned += 1

                        notification_service.notify(
                            session,
                            user_id=int(livreur.user_id),
                            event_key="TOURNEE_ASSIGNED",
                            data={
                                "tournee_id": int(tournee.id),
                                "nombre_commandes": len(commandes_chunk),
                                "date_tournee": target_date.isoformat(),
                            },
                            dedupe_suffix=str(tournee.id),
                        )

                    if suppliers_enabled():
                        # Un fournisseur peut etre servi par plusieurs livreurs : la
                        # cle d'idempotence (fournisseur, date) n'en previent qu'un seul.
                        notification_service.notify(
                            session,
                            user_id=int(fournisseur_id),
                            event_key="SUPPLIER_PICKUP_SCHEDULED",
                            data={
                                "nombre_commandes": len(commandes_fournisseur),
                                "date_tournee": target_date.isoformat(),
                            },
                            dedupe_suffix=f"{fournisseur_id}:{target_date.isoformat()}",
                        )

            return {
                "status": "success" if commandes_assigned else "no_assignable_orders",
                "target_date": target_date.isoformat(),
                "tournees_created": tournees_created,
                "commandes_assigned": commandes_assigned,
                "available_livreurs": len(livreurs),
                "commandes_sans_fournisseur": len(commandes_sans_fournisseur),
                "commandes_sans_coordonnees_fournisseur": commandes_backlog_coordonnees,
                "fournisseurs_sans_livreur": [item for item in fournisseurs_sans_livreur if item is not None],
                "commandes_sans_livreur": len(commandes) - commandes_assigned,
                "retours_depot": retours_depot,
            }
        except CommandeTransitionError as exc:
            if self._owns_session:
                session.rollback()
            raise DispatchServiceError(str(exc)) from exc
        except Exception:
            if self._owns_session:
                session.rollback()
            raise

    def get_tournees_details(self, target_date: date) -> dict[str, Any]:
        session = self._ensure_session()
        tournees = [
            tournee
            for tournee in self.tournee_dao.get_tournees_with_details(session, target_date)
            if tournee.date_tournee == target_date
        ]
        anomalies = self._get_anomalies_non_resolues(session, target_date)
        return {
            "status": "success",
            "target_date": target_date.isoformat(),
            "tournees": [self._serialize_tournee(tournee) for tournee in tournees],
            "anomalies": [self._serialize_anomalie(anomalie) for anomalie in anomalies],
        }

    def reassign_refused_orders(
        self,
        commande_ids: set[int],
        excluded_livreur_id: int,
        target_date: Optional[date] = None,
    ) -> dict[str, Any]:
        session = self._ensure_session()
        reassignment_date = target_date or today_morocco()
        normalized_commande_ids = {int(commande_id) for commande_id in commande_ids}
        transaction = session.begin_nested() if session.in_transaction() else session.begin()

        try:
            with transaction:
                commandes = self.commande_dao.get_commandes_non_assignees(
                    session,
                    commande_ids=normalized_commande_ids,
                    statuts={"REFUS_LIVREUR"},
                )
                commandes = [
                    commande
                    for commande in commandes
                    if str(commande.statut or "").strip().upper() == "REFUS_LIVREUR"
                ]
                if not commandes:
                    return {
                        "status": "no_orders",
                        "target_date": reassignment_date.isoformat(),
                        "commandes_assigned": 0,
                        "tournees_created": 0,
                        "excluded_livreur_id": int(excluded_livreur_id),
                    }

                livreurs = [
                    livreur
                    for livreur in self.livreur_dao.get_available_livreurs(session)
                    if int(livreur.user_id) != int(excluded_livreur_id)
                ]
                if not livreurs:
                    raise DispatchNoLivreurError("Aucun autre livreur disponible")

                existing_tournees = self.tournee_dao.get_tournees_by_date(session, reassignment_date)
                tournees_by_livreur = {
                    int(tournee.livreur_id): tournee
                    for tournee in existing_tournees
                    if tournee.livreur_id is not None
                }
                assigned_counts = {
                    int(livreur.user_id): len(list(tournees_by_livreur.get(int(livreur.user_id)).commandes or []))
                    if int(livreur.user_id) in tournees_by_livreur
                    else 0
                    for livreur in livreurs
                }
                selected_livreur = min(
                    livreurs,
                    key=lambda livreur: (
                        assigned_counts.get(int(livreur.user_id), 0),
                        int(livreur.user_id),
                    ),
                )
                selected_livreur_id = int(selected_livreur.user_id)
                tournee = tournees_by_livreur.get(selected_livreur_id)
                tournees_created = 0
                if tournee is None:
                    tournee = self.tournee_dao.create_tournee(
                        session,
                        livreur_id=selected_livreur_id,
                        date_tournee=reassignment_date,
                    )
                    tournees_created = 1

                ordre_passage = self.tournee_dao.get_next_ordre_passage(session, int(tournee.id))
                commandes_assigned = 0
                for commande in self._sort_commandes_for_dispatch(commandes):
                    commande.tournee_id = int(tournee.id)
                    commande.livreur_id = selected_livreur_id
                    commande.ordre_passage = ordre_passage
                    self._mettre_commande_en_attente_livreur(
                        session=session,
                        commande=commande,
                        actor_id=selected_livreur_id,
                    )
                    commandes_assigned += 1
                    ordre_passage += 1

            return {
                "status": "success",
                "target_date": reassignment_date.isoformat(),
                "tournees_created": tournees_created,
                "commandes_assigned": commandes_assigned,
                "selected_livreur_id": selected_livreur_id,
                "excluded_livreur_id": int(excluded_livreur_id),
            }
        except CommandeTransitionError as exc:
            if self._owns_session:
                session.rollback()
            raise DispatchServiceError(str(exc)) from exc
        except Exception:
            if self._owns_session:
                session.rollback()
            raise

    def resolve_anomalie_replanifier(self, anomalie_id: int, admin_id: int) -> dict[str, Any]:
        return self._resolve_anomalie(
            anomalie_id=anomalie_id,
            admin_id=admin_id,
            nouveau_statut="EN_ATTENTE",
            resolution="REPLANIFIE",
        )

    def resolve_anomalie_annuler(self, anomalie_id: int, admin_id: int) -> dict[str, Any]:
        return self._resolve_anomalie(
            anomalie_id=anomalie_id,
            admin_id=admin_id,
            nouveau_statut="ANNULEE",
            resolution="ANNULE_PERTE",
        )

    def reassign_commande(self, commande_id: int, nouvelle_tournee_id: int) -> dict[str, Any]:
        session = self._ensure_session()
        target_date = today_morocco()
        transaction = session.begin_nested() if session.in_transaction() else session.begin()

        try:
            with transaction:
                commande = self.commande_dao.get_commande_for_reassign(
                    session,
                    commande_id=commande_id,
                    for_update=True,
                )
                if commande is None:
                    raise DispatchNotFoundError("Commande introuvable.")

                current_status = str(commande.statut or "").strip().upper()
                if current_status not in REASSIGNABLE_COMMANDE_STATUSES:
                    raise DispatchServiceError(
                        "Impossible de réassigner une commande qui est déjà en cours de traitement ou finalisée."
                    )

                if commande.tournee_id is None:
                    raise DispatchServiceError("La commande n'est rattachee a aucune tournee.")

                source_tournee = self.tournee_dao.get_tournee_by_id(
                    session,
                    int(commande.tournee_id),
                    for_update=True,
                )
                if source_tournee is None:
                    raise DispatchNotFoundError("Tournee source introuvable.")

                if source_tournee.date_tournee != target_date:
                    raise DispatchServiceError("Seules les tournees du jour peuvent etre reassignees.")

                tournee = self.tournee_dao.get_tournee_by_id(
                    session,
                    nouvelle_tournee_id,
                    for_update=True,
                )
                if tournee is None:
                    raise DispatchNotFoundError("Tournee cible introuvable.")

                if tournee.livreur_id is None:
                    raise DispatchServiceError("La tournee cible n'a pas de livreur assigne.")

                if tournee.date_tournee != target_date:
                    raise DispatchServiceError("La tournee cible doit etre une tournee du jour.")

                if int(tournee.id) == int(source_tournee.id):
                    raise DispatchServiceError("La tournee cible doit etre differente de la tournee source.")

                ordre_passage = self.tournee_dao.get_next_ordre_passage(session, nouvelle_tournee_id)
                self.commande_dao.reassign_commande_to_tournee(
                    session,
                    commande=commande,
                    tournee_id=int(tournee.id),
                    livreur_id=int(tournee.livreur_id),
                    ordre_passage=ordre_passage,
                )

            return {
                "status": "success",
                "commande_id": commande_id,
                "nouvelle_tournee_id": nouvelle_tournee_id,
                "ordre_passage": ordre_passage,
            }
        except Exception:
            if self._owns_session:
                session.rollback()
            raise

    def _resolve_anomalie(
        self,
        *,
        anomalie_id: int,
        admin_id: int,
        nouveau_statut: str,
        resolution: str,
    ) -> dict[str, Any]:
        session = self._ensure_session()
        transaction = session.begin_nested() if session.in_transaction() else session.begin()

        try:
            with transaction:
                anomalie = (
                    session.query(AnomalieLogistique)
                    .options(
                        joinedload(AnomalieLogistique.commande)
                        .joinedload(Commande.livreur)
                        .joinedload(Livreur.user),
                        joinedload(AnomalieLogistique.commande)
                        .joinedload(Commande.client),
                        joinedload(AnomalieLogistique.commande)
                        .joinedload(Commande.panier)
                        .selectinload(Panier.lignes)
                        .joinedload(LignePanier.produit),
                    )
                    .filter(AnomalieLogistique.id == anomalie_id)
                    .with_for_update(of=AnomalieLogistique)
                    .first()
                )
                if anomalie is None:
                    raise DispatchNotFoundError("Anomalie introuvable.")
                if anomalie.resolved_at is not None:
                    raise DispatchServiceError("Cette anomalie est deja resolue.")

                commande = anomalie.commande
                if commande is None:
                    raise DispatchNotFoundError("Commande de l'anomalie introuvable.")

                actor_id = int(commande.livreur_id or admin_id)
                changer_statut(
                    session=session,
                    commande=commande,
                    nouveau_statut=nouveau_statut,
                    actor_id=actor_id,
                    reason=f"ANOMALIE_{resolution}",
                )
                commande.tournee_id = None
                commande.ordre_passage = None
                commande.livreur_id = None

                anomalie.resolved_at = datetime.now(timezone.utc)
                anomalie.resolved_by = admin_id
                anomalie.resolution = resolution

            return {
                "status": "success",
                "anomalie_id": anomalie_id,
                "commande_id": int(commande.id),
                "resolution": resolution,
                "nouveau_statut": nouveau_statut,
            }
        except CommandeTransitionError as exc:
            if self._owns_session:
                session.rollback()
            raise DispatchServiceError(str(exc)) from exc
        except Exception:
            if self._owns_session:
                session.rollback()
            raise

    def _allocate_livreurs_by_supplier(
        self,
        commandes_par_fournisseur: dict[int | None, list[Commande]],
        livreurs: list[Livreur],
    ) -> tuple[dict[int, list[Livreur]], list[int]]:
        supplier_ids = sorted(
            commandes_par_fournisseur,
            key=lambda fournisseur_id: (
                -len(commandes_par_fournisseur[fournisseur_id]),
                fournisseur_id,
            ),
        )
        if not supplier_ids:
            return {}, []

        livreurs_tries = sorted(livreurs, key=lambda livreur: int(livreur.user_id))
        if not livreurs_tries:
            return {}, supplier_ids

        if len(livreurs_tries) < len(supplier_ids):
            served_supplier_ids = supplier_ids[: len(livreurs_tries)]
            allocations = {
                fournisseur_id: [livreur]
                for fournisseur_id, livreur in zip(served_supplier_ids, livreurs_tries)
            }
            return allocations, supplier_ids[len(livreurs_tries):]

        total_commandes = sum(
            len(commandes_par_fournisseur[fournisseur_id])
            for fournisseur_id in supplier_ids
        )
        allocation_counts = {
            fournisseur_id: max(
                1,
                round(
                    len(livreurs_tries)
                    * len(commandes_par_fournisseur[fournisseur_id])
                    / total_commandes
                ),
            )
            for fournisseur_id in supplier_ids
        }

        while sum(allocation_counts.values()) < len(livreurs_tries):
            for fournisseur_id in supplier_ids:
                allocation_counts[fournisseur_id] += 1
                if sum(allocation_counts.values()) == len(livreurs_tries):
                    break

        while sum(allocation_counts.values()) > len(livreurs_tries):
            removable_supplier_ids = sorted(
                (
                    fournisseur_id
                    for fournisseur_id in supplier_ids
                    if allocation_counts[fournisseur_id] > 1
                ),
                key=lambda fournisseur_id: (
                    len(commandes_par_fournisseur[fournisseur_id]),
                    -allocation_counts[fournisseur_id],
                    fournisseur_id,
                ),
            )
            if not removable_supplier_ids:
                break
            allocation_counts[removable_supplier_ids[0]] -= 1

        allocations: dict[int, list[Livreur]] = {}
        cursor = 0
        for fournisseur_id in supplier_ids:
            count = allocation_counts[fournisseur_id]
            allocations[fournisseur_id] = livreurs_tries[cursor:cursor + count]
            cursor += count

        return allocations, []

    def _sort_commandes_from_pickup(
        self,
        commandes: list[Commande],
        *,
        pickup_lat: float,
        pickup_lng: float,
    ) -> list[Commande]:
        # Coordonnees resolues une seule fois par commande : la boucle plus proche
        # voisin reste O(n²) sur haversine, mais ne re-traverse plus les relations
        # client/user/addresses a chaque comparaison.
        coords_by_commande: dict[int, Optional[tuple[float, float]]] = {}
        for commande in commandes:
            latitude = self._get_default_address_coordinate(commande, "latitude")
            longitude = self._get_default_address_coordinate(commande, "longitude")
            coords_by_commande[id(commande)] = (
                (latitude, longitude) if latitude is not None and longitude is not None else None
            )

        remaining = list(commandes)
        sorted_commandes: list[Commande] = []
        current_lat = pickup_lat
        current_lng = pickup_lng

        while remaining:
            def proximity_key(commande: Commande) -> tuple:
                coords = coords_by_commande[id(commande)]
                if coords is None:
                    return (
                        1,
                        float("inf"),
                        self._datetime_sort_key(commande.date_commande),
                        int(commande.id or 0),
                    )
                return (
                    0,
                    haversine(current_lat, current_lng, coords[0], coords[1]),
                    self._datetime_sort_key(commande.date_commande),
                    int(commande.id or 0),
                )

            next_commande = min(remaining, key=proximity_key)
            remaining.remove(next_commande)
            sorted_commandes.append(next_commande)

            next_coords = coords_by_commande[id(next_commande)]
            if next_coords is not None:
                current_lat, current_lng = next_coords

        return sorted_commandes

    def _sort_commandes_for_dispatch(self, commandes: list[Commande]) -> list[Commande]:
        return sorted(
            commandes,
            key=lambda commande: (
                self._missing_latitude_sort_key(commande),
                self._latitude_sort_key(commande),
                self._longitude_sort_key(commande),
                self._datetime_sort_key(commande.date_commande),
                int(commande.id or 0),
            ),
        )

    def _is_commande_locked_for_dispatch(self, commande: Commande) -> bool:
        return str(commande.statut or "").strip().upper() == LOCKED_DISPATCH_STATUS

    def _mettre_commande_en_attente_livreur(self, session: Session, commande: Commande, actor_id: int) -> None:
        current_status = str(commande.statut or "").strip().upper()
        status_steps = DISPATCH_STATUS_PROGRESSIONS.get(current_status)

        if not status_steps:
            raise DispatchServiceError(
                f"Commande {commande.id} non eligible au dispatch depuis le statut {current_status or 'INCONNU'}."
            )

        for next_status in status_steps:
            changer_statut(
                session=session,
                commande=commande,
                nouveau_statut=next_status,
                actor_id=actor_id,
                reason=f"DISPATCH_DAILY_{next_status}",
            )

    def _split_equally(self, commandes: list[Commande], livreur_count: int) -> list[list[Commande]]:
        chunk_count = min(len(commandes), max(livreur_count, 1))
        base_size, remainder = divmod(len(commandes), chunk_count)
        chunks: list[list[Commande]] = []
        start = 0

        for index in range(chunk_count):
            size = base_size + (1 if index < remainder else 0)
            end = start + size
            chunks.append(commandes[start:end])
            start = end

        return chunks

    def _missing_latitude_sort_key(self, commande: Commande) -> int:
        return 0 if self._get_default_address_coordinate(commande, "latitude") is not None else 1

    def _latitude_sort_key(self, commande: Commande) -> float:
        latitude = self._get_default_address_coordinate(commande, "latitude")
        return float(latitude) if latitude is not None else 0.0

    def _longitude_sort_key(self, commande: Commande) -> float:
        longitude = self._get_default_address_coordinate(commande, "longitude")
        return float(longitude) if longitude is not None else 0.0

    def _datetime_sort_key(self, value) -> datetime:
        return value if isinstance(value, datetime) else datetime.min

    def _get_default_address_coordinate(self, commande: Commande, coordinate_name: str) -> Optional[float]:
        user = commande.client.user if commande.client and commande.client.user else None
        addresses = list(user.addresses) if user and user.addresses else []

        if not addresses:
            return None

        default_address = next((address for address in addresses if address.is_default), addresses[0])
        coordinate = getattr(default_address, coordinate_name, None)
        return float(coordinate) if coordinate is not None else None

    def _serialize_tournee(self, tournee) -> dict[str, Any]:
        livreur = tournee.livreur
        livreur_user = livreur.user if livreur and livreur.user else None
        fournisseur = getattr(tournee, "fournisseur", None)
        commandes = sorted(
            list(tournee.commandes or []),
            key=lambda commande: (commande.ordre_passage or 999_999, commande.id or 0),
        )

        return {
            "id": int(tournee.id),
            "date_tournee": tournee.date_tournee.isoformat() if tournee.date_tournee else None,
            "statut": str(tournee.statut or "PLANIFIEE"),
            "distance_totale_km": float(tournee.distance_totale_km) if tournee.distance_totale_km is not None else None,
            "created_at": tournee.created_at.isoformat() if tournee.created_at else None,
            "livreur": {
                "user_id": int(livreur.user_id) if livreur and livreur.user_id is not None else None,
                "nom": self._build_user_label(livreur_user, prefix="Livreur"),
                "email": str(livreur_user.email) if livreur_user and livreur_user.email else None,
                "phone": str(livreur_user.phone) if livreur_user and livreur_user.phone else None,
                "vehicule": str(livreur.vehicule) if livreur and livreur.vehicule else None,
                "disponible": bool(livreur.disponible) if livreur and livreur.disponible is not None else None,
                "note_moyenne": float(livreur.note_moyenne) if livreur and livreur.note_moyenne is not None else None,
            },
            "pickup": {
                "fournisseur_id": int(tournee.fournisseur_id)
                if tournee.fournisseur_id is not None
                else None,
                "shop_name": str(fournisseur.shop_name)
                if fournisseur and fournisseur.shop_name
                else depot_identity()["shop_name"],
                "address": str(fournisseur.address)
                if fournisseur and fournisseur.address
                else depot_identity()["address"],
                "ville": str(fournisseur.ville)
                if fournisseur and fournisseur.ville
                else depot_identity()["ville"],
                "phone": str(fournisseur.phone)
                if fournisseur and fournisseur.phone
                else depot_identity()["phone"],
                "latitude": float(tournee.pickup_lat)
                if tournee.pickup_lat is not None
                else None,
                "longitude": float(tournee.pickup_lng)
                if tournee.pickup_lng is not None
                else None,
            },
            "commandes": [self._serialize_commande(commande) for commande in commandes],
        }

    def _serialize_commande(self, commande: Commande) -> dict[str, Any]:
        user = commande.client.user if commande.client and commande.client.user else None
        address = self._get_default_address(user)
        return {
            "id": int(commande.id),
            "client_id": int(commande.client_id) if commande.client_id is not None else None,
            "client_nom": self._build_user_label(user, prefix="Client"),
            "client_phone": str(user.phone) if user and user.phone else None,
            "statut": str(commande.statut or ""),
            "ordre_passage": int(commande.ordre_passage) if commande.ordre_passage is not None else None,
            "creneau_livraison": str(commande.creneau_livraison) if commande.creneau_livraison else None,
            "montant_total": float(commande.montant_total or 0.0),
            "date_commande": commande.date_commande.isoformat() if commande.date_commande else None,
            "mode_paiement": str(commande.mode_paiement) if commande.mode_paiement else None,
            "adresse": self._serialize_address(address),
            "retour_depot_at": commande.retour_depot_at.isoformat() if commande.retour_depot_at else None,
            "produits": self._serialize_commande_products(commande),
        }

    def _get_anomalies_non_resolues(self, session: Session, target_date: date) -> list[AnomalieLogistique]:
        return (
            session.query(AnomalieLogistique)
            .options(
                joinedload(AnomalieLogistique.commande)
                .joinedload(Commande.client),
                joinedload(AnomalieLogistique.commande)
                .joinedload(Commande.livreur)
                .joinedload(Livreur.user),
                joinedload(AnomalieLogistique.commande)
                .joinedload(Commande.panier)
                .selectinload(Panier.lignes)
                .joinedload(LignePanier.produit),
            )
            .filter(
                AnomalieLogistique.resolved_at.is_(None),
                func.date(AnomalieLogistique.detected_at) == target_date,
            )
            .order_by(AnomalieLogistique.detected_at.desc(), AnomalieLogistique.id.desc())
            .all()
        )

    def _serialize_anomalie(self, anomalie: AnomalieLogistique) -> dict[str, Any]:
        commande = anomalie.commande
        livreur = commande.livreur if commande and commande.livreur else None
        livreur_user = livreur.user if livreur and livreur.user else None
        detected_at = anomalie.detected_at
        return {
            "id": int(anomalie.id),
            "commande_id": int(anomalie.commande_id),
            "type_anomalie": str(anomalie.type_anomalie),
            "detected_at": detected_at.isoformat() if detected_at else None,
            "resolved_at": anomalie.resolved_at.isoformat() if anomalie.resolved_at else None,
            "resolution": str(anomalie.resolution) if anomalie.resolution else None,
            "date_tournee_ratee": detected_at.date().isoformat() if detected_at else None,
            "livreur_defaillant": {
                "user_id": int(livreur.user_id) if livreur and livreur.user_id is not None else None,
                "nom": self._build_user_label(livreur_user, prefix="Livreur"),
                "email": str(livreur_user.email) if livreur_user and livreur_user.email else None,
                "phone": str(livreur_user.phone) if livreur_user and livreur_user.phone else None,
                "vehicule": str(livreur.vehicule) if livreur and livreur.vehicule else None,
                "disponible": bool(livreur.disponible) if livreur and livreur.disponible is not None else None,
                "note_moyenne": float(livreur.note_moyenne) if livreur and livreur.note_moyenne is not None else None,
            },
            "commande": self._serialize_commande(commande) if commande else None,
        }

    def _serialize_commande_products(self, commande: Commande) -> list[dict[str, Any]]:
        lignes = list(commande.panier.lignes) if commande.panier and commande.panier.lignes else []
        produits = []
        for ligne in lignes:
            produit = ligne.produit
            produits.append(
                {
                    "ligne_panier_id": int(ligne.id) if ligne.id is not None else None,
                    "product_id": int(ligne.produit_id) if ligne.produit_id is not None else None,
                    "nom_fr": str(produit.nom_fr) if produit else "Produit supprime",
                    "quantite_kg": float(ligne.quantite_kg or 0.0),
                    "sous_total": float(ligne.sous_total) if ligne.sous_total is not None else None,
                }
            )
        return produits

    def _build_user_label(self, user, prefix: str) -> str:
        if user and user.email:
            return str(user.email)
        if user and user.phone:
            return str(user.phone)
        if user and user.id is not None:
            return f"{prefix} #{user.id}"
        return f"{prefix} inconnu"

    def _get_default_address(self, user):
        addresses = list(user.addresses) if user and user.addresses else []
        if not addresses:
            return None
        return next((address for address in addresses if address.is_default), addresses[0])

    def _serialize_address(self, address) -> dict[str, Any] | None:
        if address is None:
            return None

        parts = [
            str(part).strip()
            for part in (address.street, address.neighborhood, address.ville)
            if part and str(part).strip()
        ]
        details = str(address.details).strip() if address.details else None
        full_address = ", ".join(parts)
        if details:
            full_address = f"{full_address} ({details})" if full_address else details

        return {
            "street": str(address.street) if address.street else None,
            "neighborhood": str(address.neighborhood) if address.neighborhood else None,
            "details": details,
            "ville": str(address.ville) if address.ville else None,
            "latitude": float(address.latitude) if address.latitude is not None else None,
            "longitude": float(address.longitude) if address.longitude is not None else None,
            "full_address": full_address or None,
        }
