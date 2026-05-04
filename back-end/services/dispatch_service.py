from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session, joinedload, selectinload

from config import LocalSession
from entities.anomalie_entity import AnomalieLogistique
from entities.commande_entity import Commande
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


DISPATCH_TARGET_STATUS = "A_LIVRER"
REASSIGNABLE_COMMANDE_STATUSES = {"A_LIVRER", "PLANIFIEE"}


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

    def generate_daily_routes(self, target_date: date) -> dict[str, Any]:
        session = self._ensure_session()
        transaction = session.begin_nested() if session.in_transaction() else session.begin()

        try:
            with transaction:
                retours_depot = process_end_of_day_returns(session, target_date)
                commandes = self.commande_dao.get_commandes_non_assignees(session)
                if not commandes:
                    return {
                        "status": "no_orders",
                        "target_date": target_date.isoformat(),
                        "count": 0,
                        "tournees_created": 0,
                        "commandes_assigned": 0,
                        "retours_depot": retours_depot,
                    }

                livreurs = self.livreur_dao.get_available_livreurs(session)
                if not livreurs:
                    raise DispatchNoLivreurError("Aucun livreur disponible")

                sorted_commandes = self._sort_commandes_for_dispatch(commandes)
                chunks = self._split_equally(sorted_commandes, len(livreurs))

                tournees_created = 0
                commandes_assigned = 0

                for livreur, commandes_chunk in zip(livreurs, chunks):
                    if not commandes_chunk:
                        continue

                    tournee = self.tournee_dao.create_tournee(
                        session,
                        livreur_id=int(livreur.user_id),
                        date_tournee=target_date,
                    )
                    tournees_created += 1

                    for index, commande in enumerate(commandes_chunk, start=1):
                        commande.tournee_id = int(tournee.id)
                        commande.livreur_id = int(livreur.user_id)
                        commande.ordre_passage = index
                        changer_statut(
                            session=session,
                            commande=commande,
                            nouveau_statut=DISPATCH_TARGET_STATUS,
                            actor_id=int(livreur.user_id),
                            reason="DISPATCH_DAILY",
                        )
                        commandes_assigned += 1

            return {
                "status": "success",
                "target_date": target_date.isoformat(),
                "tournees_created": tournees_created,
                "commandes_assigned": commandes_assigned,
                "available_livreurs": len(livreurs),
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
        tournees = self.tournee_dao.get_tournees_with_details(session, target_date)
        anomalies = self._get_anomalies_non_resolues(session)
        return {
            "status": "success",
            "target_date": target_date.isoformat(),
            "tournees": [self._serialize_tournee(tournee) for tournee in tournees],
            "anomalies": [self._serialize_anomalie(anomalie) for anomalie in anomalies],
        }

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

                tournee = self.tournee_dao.get_tournee_by_id(
                    session,
                    nouvelle_tournee_id,
                    for_update=True,
                )
                if tournee is None:
                    raise DispatchNotFoundError("Tournee cible introuvable.")

                if tournee.livreur_id is None:
                    raise DispatchServiceError("La tournee cible n'a pas de livreur assigne.")

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

    def _get_anomalies_non_resolues(self, session: Session) -> list[AnomalieLogistique]:
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
            .filter(AnomalieLogistique.resolved_at.is_(None))
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
