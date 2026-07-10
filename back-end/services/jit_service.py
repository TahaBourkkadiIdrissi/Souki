import math
from datetime import date, datetime, time
from typing import Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy import func

from config import LocalSession
from dto.jit_dto import DetailProduitJIT, JITLogDTO, ResultatAgregationJIT, ZoneJITDTO
from entities.abonnement_entity import Abonnement
from entities.address_entity import Address
from entities.commande_entity import Commande
from entities.panier_entity import Panier
from interfaces.jit_dao_interface import IJITDao
from interfaces.jit_service_interface import IJITService
from interfaces.zone_jit_dao_interface import IZoneJITDao
from services.commande_state_machine import changer_statut
from services.date_utils import today_morocco
from services.fournisseur_resolver import resoudre_fournisseur_pour_adresse
from services.notification_jit_service import notifier_fournisseur
from services.zone_resolver import resoudre_zone


PENDING_JIT_STATUSES = ("EN_ATTENTE", "CONFIRMEE")
LOCKED_JIT_STATUS = "VERROUILLEE"
UNLOCKED_JIT_STATUS = "CONFIRMEE"
JIT_LOCK_ID = 20240520


class JITAlreadyExecutedError(Exception):
    """Raised when the daily JIT has already locked orders."""


class JITService(IJITService):
    """Service pour l'agregation JIT des commandes."""

    def __init__(self, jit_dao: IJITDao, zone_jit_dao: Optional[IZoneJITDao] = None) -> None:
        self.jit_dao = jit_dao
        self.zone_jit_dao = zone_jit_dao

    def _today_bounds(self) -> tuple[datetime, datetime]:
        today = today_morocco()  # heure du Maroc, pas l'heure locale du serveur
        return datetime.combine(today, time.min), datetime.combine(today, time.max)

    def _count_locked_commandes_today(self, session: Session) -> int:
        start_of_day, end_of_day = self._today_bounds()
        return (
            session.query(Commande)
            .filter(
                func.upper(func.coalesce(Commande.statut, "")) == LOCKED_JIT_STATUS,
                Commande.date_commande >= start_of_day,
                Commande.date_commande <= end_of_day,
            )
            .count()
        )

    def _get_default_geolocated_addresses(
        self,
        session: Session,
        client_ids: List[int],
    ) -> dict[int, Address]:
        normalized_ids = sorted({int(client_id) for client_id in client_ids if client_id is not None})
        if not normalized_ids:
            return {}

        addresses = (
            session.query(Address)
            .filter(
                Address.user_id.in_(normalized_ids),
                Address.is_default == True,
                Address.latitude.isnot(None),
                Address.longitude.isnot(None),
            )
            .order_by(Address.user_id.asc(), Address.id.asc())
            .all()
        )

        addresses_by_client: dict[int, Address] = {}
        for address in addresses:
            client_id = int(address.user_id)
            if client_id not in addresses_by_client:
                addresses_by_client[client_id] = address
        return addresses_by_client

    def _filter_commandes_by_zone(
        self,
        commandes: List[Commande],
        zone: ZoneJITDTO,
        addresses_by_client: dict[int, Address],
        *,
        allow_unlocated_fallback: bool = False,
    ) -> List[Commande]:
        dans_zone = []
        for commande in commandes:
            client_id = int(commande.client_id) if commande.client_id is not None else None
            addr = addresses_by_client.get(client_id) if client_id is not None else None
            if addr and resoudre_zone(float(addr.latitude), float(addr.longitude), [zone]):  # type: ignore
                dans_zone.append(commande)
            elif (
                not addr
                and allow_unlocated_fallback
                and getattr(zone, "fournisseur_id", None) is not None
            ):
                dans_zone.append(commande)
        return dans_zone

    def _get_commandes_du_jour(
        self,
        session: Session,
        zone: Optional[ZoneJITDTO] = None,
        allow_unlocated_fallback: bool = False,
    ) -> List[Commande]:
        """Retourne les commandes du jour. Si zone fournie, filtre géographiquement."""
        start_of_day, end_of_day = self._today_bounds()
        commandes = (
            session.query(Commande)
            .filter(
                func.upper(func.coalesce(Commande.statut, "")).in_(PENDING_JIT_STATUSES),
                Commande.date_commande >= start_of_day,
                Commande.date_commande <= end_of_day,
            )
            .all()
        )

        if zone is None:
            return commandes

        addresses_by_client = self._get_default_geolocated_addresses(
            session,
            [int(commande.client_id) for commande in commandes if commande.client_id is not None],
        )
        return self._filter_commandes_by_zone(
            commandes,
            zone,
            addresses_by_client,
            allow_unlocated_fallback=allow_unlocated_fallback,
        )

    def agreger_commandes(
        self,
        session: Session,
        zone: Optional[ZoneJITDTO] = None,
        allow_unlocated_fallback: bool = False,
    ) -> ResultatAgregationJIT:
        """
        Agrege les commandes confirmees et les abonnements actifs.
        Si zone fournie, filtre par zone géographique.
        Calcule les volumes avec buffer 10% et arrondit a la caisse entiere.
        """
        volumes_par_produit: Dict[int, Dict] = {}

        commandes = self._get_commandes_du_jour(
            session,
            zone=zone,
            allow_unlocated_fallback=allow_unlocated_fallback,
        )

        for commande in commandes:
            panier = session.query(Panier).filter(Panier.id == commande.panier_id).first()
            if not panier:
                continue

            for ligne in panier.lignes:
                produit = ligne.produit
                if not produit:
                    continue

                product_id = produit.id
                quantite = ligne.quantite_kg or 0.0

                if product_id not in volumes_par_produit:
                    prix_achat = (
                        produit.prix_gros_saisi
                        if produit.prix_gros_saisi is not None
                        else produit.prix_kg
                    )
                    volumes_par_produit[product_id] = {
                        "nom_fr": produit.nom_fr,
                        "nom_darija": produit.nom_darija,
                        "quantite_brute": 0.0,
                        "prix_kg": produit.prix_affiche or produit.prix_kg,
                        "prix_achat": prix_achat,
                        "unite": produit.unite,
                    }

                volumes_par_produit[product_id]["quantite_brute"] += quantite

        abonnements = session.query(Abonnement).filter(Abonnement.actif == True).all()
        nombre_abonnements = len(abonnements)

        buffer_perte = 0.10
        details_produits: List[DetailProduitJIT] = []
        volume_total = 0.0
        ca_estime_total = 0.0
        cout_achat_estime = 0.0

        for product_id, info in volumes_par_produit.items():
            quantite_brute = info["quantite_brute"]
            buffer = quantite_brute * buffer_perte
            volume_avec_buffer = quantite_brute + buffer
            volume_final = math.ceil(volume_avec_buffer)

            prix_kg = info["prix_kg"]
            prix_achat = info["prix_achat"]
            sous_total_ca = quantite_brute * prix_kg
            sous_total_achat = quantite_brute * prix_achat

            detail = DetailProduitJIT(
                product_id=product_id,
                nom_fr=info["nom_fr"],
                nom_darija=info["nom_darija"],
                quantite_brute_kg=round(quantite_brute, 2),
                buffer_perte_10_pct=round(buffer, 2),
                volume_total_kg=float(volume_final),
                prix_kg=prix_kg,
                prix_achat=prix_achat,
                sous_total=round(sous_total_ca, 2),
                sous_total_ca=round(sous_total_ca, 2),
                sous_total_achat=round(sous_total_achat, 2),
                unite=info["unite"],
            )

            details_produits.append(detail)
            volume_total += volume_final
            ca_estime_total += sous_total_ca
            cout_achat_estime += sous_total_achat

        statut = "succès" if len(commandes) > 0 else "aucune_commande"
        message = None if len(commandes) > 0 else "Aucune commande confirmee - annulation de tournee ?"

        return ResultatAgregationJIT(
            nombre_commandes=len(commandes),
            nombre_abonnements=nombre_abonnements,
            volume_total_kg=round(volume_total, 2),
            details_produits=details_produits,
            montant_total=round(ca_estime_total, 2),
            ca_estime_total=round(ca_estime_total, 2),
            cout_achat_estime=round(cout_achat_estime, 2),
            marge_estimee=round(ca_estime_total - cout_achat_estime, 2),
            statut=statut,
            message=message,
        )

    def verrouiller_commandes(
        self,
        session: Session,
        actor_id: int = 0,
        zone: Optional[ZoneJITDTO] = None,
        allow_unlocated_fallback: bool = False,
    ) -> int:
        """
        Verrouille les commandes EN_ATTENTE ou CONFIRMEE.
        Si zone fournie, verrouille seulement les commandes de cette zone.
        Retourne le nombre de commandes verrouillees.
        """
        try:
            commandes = self._get_commandes_du_jour(
                session,
                zone=zone,
                allow_unlocated_fallback=allow_unlocated_fallback,
            )
            zones = [zone] if zone is not None else (
                self.zone_jit_dao.get_zones_actives(session)
                if self.zone_jit_dao
                else []
            )
            addresses_by_client = self._get_default_geolocated_addresses(
                session,
                [int(commande.client_id) for commande in commandes if commande.client_id is not None],
            )

            nombre_verrouillees = 0
            for commande in commandes:
                # Savepoint par commande : une commande qui échoue (statut inattendu,
                # erreur transitoire) est ignoree et loggee, sans abandonner le verrouillage
                # des autres commandes du jour.
                try:
                    with session.begin_nested():
                        client_id = int(commande.client_id) if commande.client_id is not None else None
                        adresse = addresses_by_client.get(client_id) if client_id is not None else None
                        fournisseur_id = resoudre_fournisseur_pour_adresse(adresse, zones)

                        # Conserver la logique HEAD de fallback.
                        if (
                            fournisseur_id is None
                            and allow_unlocated_fallback
                            and zone is not None
                        ):
                            fallback_fournisseur_id = getattr(
                                zone,
                                "fournisseur_id",
                                None,
                            )
                            if fallback_fournisseur_id is not None:
                                fournisseur_id = int(fallback_fournisseur_id)

                        if fournisseur_id is None:
                            print(
                                f"[JIT] Commande {commande.id} sans fournisseur résolu; "
                                "conservée pour le backlog admin."
                            )
                            continue

                        current_status = str(commande.statut or "").strip().upper()
                        if current_status == "EN_ATTENTE":
                            changer_statut(
                                session=session,
                                commande=commande,
                                nouveau_statut="CONFIRMEE",
                                actor_id=actor_id,
                                reason="JIT_CONFIRMATION",
                            )
                        commande.fournisseur_id = fournisseur_id
                        changer_statut(
                            session=session,
                            commande=commande,
                            nouveau_statut=LOCKED_JIT_STATUS,
                            actor_id=actor_id,
                            reason="JIT_LOCK",
                        )
                    nombre_verrouillees += 1
                except Exception as exc:
                    print(f"Commande {commande.id} non verrouillee (ignoree): {exc}")

            session.flush()
            return nombre_verrouillees
        except Exception as exc:
            print(f"Erreur lors du verrouillage des commandes: {exc}")
            raise

    def deverrouiller_commandes(
        self, session: Session, actor_id: int = 0, zone_id: Optional[int] = None
    ) -> Dict:
        """
        Deverrouille les commandes verrouillees par le JIT.
        Si zone_id fourni, limite le déverrouillage aux commandes de cette zone.
        Retourne le nombre et le detail des commandes rouvertes.
        """
        try:
            start_of_day, end_of_day = self._today_bounds()

            query = session.query(Commande).filter(
                func.upper(func.coalesce(Commande.statut, "")) == LOCKED_JIT_STATUS,
                Commande.date_commande >= start_of_day,
                Commande.date_commande <= end_of_day,
            )
            commandes_raw = query.all()

            if zone_id is not None:
                zone_dto = (
                    self.zone_jit_dao.get_zone_by_id(session, zone_id)
                    if self.zone_jit_dao
                    else None
                )
                if zone_dto:
                    addresses_by_client = self._get_default_geolocated_addresses(
                        session,
                        [int(c.client_id) for c in commandes_raw if c.client_id is not None],
                    )
                    commandes_a_ouvrir = self._filter_commandes_by_zone(
                        commandes_raw,
                        zone_dto,
                        addresses_by_client,
                    )
                else:
                    commandes_a_ouvrir = commandes_raw
            else:
                commandes_a_ouvrir = commandes_raw

            commandes_deverrouillees = []
            for commande in commandes_a_ouvrir:
                statut_avant = str(commande.statut) if commande.statut else None
                changer_statut(
                    session=session,
                    commande=commande,
                    nouveau_statut=UNLOCKED_JIT_STATUS,
                    actor_id=actor_id,
                    reason="JIT_UNLOCK",
                )
                commandes_deverrouillees.append(
                    {
                        "id": int(commande.id),  # type: ignore
                        "date_commande": commande.date_commande.isoformat() if commande.date_commande else None,  # type: ignore
                        "statut_avant": statut_avant,
                        "statut_apres": UNLOCKED_JIT_STATUS,
                    }
                )

            session.flush()
            return {
                "nombre_deverrouillees": len(commandes_deverrouillees),
                "commandes": commandes_deverrouillees,
            }
        except Exception as exc:
            print(f"Erreur lors du deverrouillage des commandes: {exc}")
            raise

    def executer_job_jit(self, session: Session, actor_id: int = 0) -> JITLogDTO:
        """
        Execute le job JIT complet (global, sans filtrage par zone) :
        1. Agrege les commandes
        2. Verrouille les commandes
        3. Cree un log
        """
        try:
            acquired = session.execute(
                text("SELECT pg_try_advisory_xact_lock(:lock_id)"),
                {"lock_id": JIT_LOCK_ID},
            ).scalar()
            if not acquired:
                raise JITAlreadyExecutedError(
                    "JIT deja en cours d'execution. Reessayez dans quelques secondes."
                )

            locked_count = self._count_locked_commandes_today(session)
            if locked_count > 0:
                raise JITAlreadyExecutedError(
                    f"Le JIT du jour est deja lance: {locked_count} commande(s) verrouillee(s). "
                    "Deverrouillez le JIT avant de le relancer."
                )

            print("Demarrage du job JIT d'agregation des commandes...")

            resultat = self.agreger_commandes(session)
            print(
                f"Agregation complete: {resultat.nombre_commandes} commandes, "
                f"{resultat.volume_total_kg} kg total"
            )

            if resultat.statut == "succès":
                nombre_verrouillees = self.verrouiller_commandes(session, actor_id=actor_id)
                print(f"{nombre_verrouillees} commandes verrouillees")

            details_json = self._build_details_json(resultat)

            log = self.jit_dao.create_log(
                session,
                volume_total=resultat.volume_total_kg,
                nombre_commandes=resultat.nombre_commandes,
                nombre_abonnements=resultat.nombre_abonnements,
                statut=resultat.statut,
                details_volumes=details_json,
                message_alerte=resultat.message,
            )

            session.commit()
            print(f"Log JIT cree (ID: {log.id if log else 'N/A'})")

            return log or JITLogDTO(
                volume_total=resultat.volume_total_kg,
                nombre_commandes=resultat.nombre_commandes,
                nombre_abonnements=resultat.nombre_abonnements,
                statut="erreur",
                message_alerte="Erreur lors de la creation du log",
            )

        except JITAlreadyExecutedError:
            session.rollback()
            raise
        except Exception as exc:
            print(f"Erreur lors de l'execution du job JIT: {exc}")
            session.rollback()

            try:
                # Reutilise la session injectee (deja rollback, donc propre) pour journaliser
                # l'erreur, au lieu de creer un LocalSession() dans le service (cf. MVC2).
                error_log = self.jit_dao.create_log(
                    session,
                    volume_total=0.0,
                    nombre_commandes=0,
                    nombre_abonnements=0,
                    statut="erreur",
                    message_alerte=f"Erreur: {exc}",
                )
                session.commit()
                return error_log or JITLogDTO(
                    volume_total=0.0,
                    nombre_commandes=0,
                    nombre_abonnements=0,
                    statut="erreur",
                    message_alerte=str(exc),
                )
            except Exception as log_error:
                session.rollback()
                print(f"Erreur lors de la creation du log d'erreur: {log_error}")
                return JITLogDTO(
                    volume_total=0.0,
                    nombre_commandes=0,
                    nombre_abonnements=0,
                    statut="erreur",
                    message_alerte=f"Erreur double: {exc} + {log_error}",
                )

    def executer_job_jit_regional(self, actor_id: int = 0) -> Dict[str, dict]:
        """
        Execute le job JIT pour chaque zone active independamment.
        Chaque zone a sa propre transaction : si une zone echoue,
        les autres continuent. Retourne un resume par nom_ville.
        """
        if not self.zone_jit_dao:
            raise RuntimeError("zone_jit_dao requis pour executer_job_jit_regional()")

        meta_session = LocalSession()
        try:
            zones = self.zone_jit_dao.get_zones_actives(meta_session)
        finally:
            meta_session.close()

        if not zones:
            print("Aucune zone JIT active configuree.")
            raise RuntimeError(
                "Aucune zone JIT active configuree. Activez au moins une zone JIT avec un fournisseur affecte."
            )

        resultats: Dict[str, dict] = {}
        allow_unlocated_fallback = len(zones) == 1

        for zone_dto in zones:
            zone_session = LocalSession()
            try:
                if self.jit_dao.zone_deja_executee_aujourd_hui(zone_session, zone_dto.id):  # type: ignore
                    locked_count = self._count_locked_commandes_today(zone_session)
                    if locked_count > 0:
                        print(f"[JIT] Zone {zone_dto.nom_ville} deja executee aujourd'hui - ignoree")
                        resultats[zone_dto.nom_ville] = {
                            "statut": "deja_execute",
                            "nombre_commandes": locked_count,
                            "nombre_verrouillees": locked_count,
                        }
                        continue
                    print(
                        f"[JIT] Zone {zone_dto.nom_ville} a un log succes sans commande verrouillee; "
                        "relance autorisee."
                    )

                print(f"[JIT] Demarrage zone {zone_dto.nom_ville}...")

                resultat = self.agreger_commandes(
                    zone_session,
                    zone=zone_dto,
                    allow_unlocated_fallback=allow_unlocated_fallback,
                )
                nb = 0
                print(
                    f"[JIT] {zone_dto.nom_ville}: {resultat.nombre_commandes} commandes, "
                    f"{resultat.volume_total_kg} kg"
                )

                if resultat.statut == "succès":
                    nb = self.verrouiller_commandes(
                        zone_session,
                        actor_id=actor_id,
                        zone=zone_dto,
                        allow_unlocated_fallback=allow_unlocated_fallback,
                    )
                    print(f"[JIT] {zone_dto.nom_ville}: {nb} commandes verrouillees")
                    if resultat.nombre_commandes > 0 and nb == 0:
                        raise RuntimeError(
                            "Aucune commande verrouillee: verifiez que la zone a un fournisseur affecte "
                            "et que les clients ont une adresse par defaut geolocalisee dans cette zone."
                        )
                    notifier_fournisseur(zone_session, zone_dto, resultat)

                details_json = self._build_details_json(resultat)

                log = self.jit_dao.create_log(
                    zone_session,
                    volume_total=resultat.volume_total_kg,
                    nombre_commandes=resultat.nombre_commandes,
                    nombre_abonnements=resultat.nombre_abonnements,
                    statut=resultat.statut,
                    details_volumes=details_json,
                    message_alerte=resultat.message,
                    zone_id=zone_dto.id,
                    nom_ville=zone_dto.nom_ville,
                )

                zone_session.commit()
                print(f"[JIT] Zone {zone_dto.nom_ville} terminee (log ID: {log.id if log else 'N/A'})")

                resultats[zone_dto.nom_ville] = {
                    "statut": resultat.statut,
                    "log_id": log.id if log else None,
                    "volume_total_kg": resultat.volume_total_kg,
                    "nombre_commandes": resultat.nombre_commandes,
                    "nombre_verrouillees": nb,
                    "montant_total": resultat.montant_total,
                    "message": resultat.message,
                }

            except Exception as exc:
                zone_session.rollback()
                print(f"[JIT] ERREUR zone {zone_dto.nom_ville}: {exc}")

                try:
                    err_session = LocalSession()
                    self.jit_dao.create_log(
                        err_session,
                        volume_total=0.0,
                        nombre_commandes=0,
                        nombre_abonnements=0,
                        statut="erreur",
                        message_alerte=f"Erreur zone {zone_dto.nom_ville}: {exc}",
                        zone_id=zone_dto.id,
                        nom_ville=zone_dto.nom_ville,
                    )
                    err_session.commit()
                    err_session.close()
                except Exception as log_err:
                    print(f"[JIT] Impossible de logger l'erreur zone {zone_dto.nom_ville}: {log_err}")

                resultats[zone_dto.nom_ville] = {"statut": "erreur", "message": str(exc)}

            finally:
                zone_session.close()

        return resultats

    def executer_job_jit_zone(
        self, zone_id: int, actor_id: int = 0
    ) -> JITLogDTO:
        """Execute le job JIT pour une seule zone (test ou rattrapage)."""
        if not self.zone_jit_dao:
            raise RuntimeError("zone_jit_dao requis pour executer_job_jit_zone()")

        session = LocalSession()
        try:
            zone_dto = self.zone_jit_dao.get_zone_by_id(session, zone_id)
            if not zone_dto:
                raise ValueError(f"Zone {zone_id} introuvable")
            if not zone_dto.actif:
                raise ValueError(f"Zone {zone_dto.nom_ville} est inactive")

            resultat = self.agreger_commandes(
                session,
                zone=zone_dto,
                allow_unlocated_fallback=True,
            )

            if resultat.statut == "succès":
                self.verrouiller_commandes(
                    session,
                    actor_id=actor_id,
                    zone=zone_dto,
                    allow_unlocated_fallback=True,
                )
                notifier_fournisseur(session, zone_dto, resultat)

            details_json = self._build_details_json(resultat)

            log = self.jit_dao.create_log(
                session,
                volume_total=resultat.volume_total_kg,
                nombre_commandes=resultat.nombre_commandes,
                nombre_abonnements=resultat.nombre_abonnements,
                statut=resultat.statut,
                details_volumes=details_json,
                message_alerte=resultat.message,
                zone_id=zone_dto.id,
                nom_ville=zone_dto.nom_ville,
            )

            session.commit()

            return log or JITLogDTO(
                volume_total=resultat.volume_total_kg,
                nombre_commandes=resultat.nombre_commandes,
                nombre_abonnements=resultat.nombre_abonnements,
                statut="erreur",
                message_alerte="Log non cree",
            )

        except Exception as exc:
            session.rollback()
            try:
                err_session = LocalSession()
                error_log = self.jit_dao.create_log(
                    err_session,
                    volume_total=0.0,
                    nombre_commandes=0,
                    nombre_abonnements=0,
                    statut="erreur",
                    message_alerte=f"Erreur: {exc}",
                    zone_id=zone_id,
                )
                err_session.commit()
                err_session.close()
                return error_log or JITLogDTO(
                    volume_total=0.0,
                    nombre_commandes=0,
                    nombre_abonnements=0,
                    statut="erreur",
                    message_alerte=str(exc),
                )
            except Exception:
                return JITLogDTO(
                    volume_total=0.0,
                    nombre_commandes=0,
                    nombre_abonnements=0,
                    statut="erreur",
                    message_alerte=str(exc),
                )
        finally:
            session.close()

    @staticmethod
    def _build_details_json(resultat: ResultatAgregationJIT) -> dict:
        return {
            "produits": [
                {
                    "product_id": d.product_id,
                    "nom_fr": d.nom_fr,
                    "quantite_brute_kg": d.quantite_brute_kg,
                    "buffer_10_pct": d.buffer_perte_10_pct,
                    "volume_final_kg": d.volume_total_kg,
                    "prix_kg": d.prix_kg,
                    "prix_achat": d.prix_achat,
                    "sous_total": d.sous_total,
                    "sous_total_ca": d.sous_total_ca,
                    "sous_total_achat": d.sous_total_achat,
                }
                for d in resultat.details_produits
            ],
            "ca_estime_total": resultat.ca_estime_total,
            "cout_achat_estime": resultat.cout_achat_estime,
            "marge_estimee": resultat.marge_estimee,
        }
