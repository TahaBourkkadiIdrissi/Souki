import math
from datetime import date, datetime, time
from typing import Dict, List

from sqlalchemy.orm import Session

from config import LocalSession
from dto.jit_dto import DetailProduitJIT, JITLogDTO, ResultatAgregationJIT
from entities.abonnement_entity import Abonnement
from entities.commande_entity import Commande
from entities.panier_entity import Panier
from interfaces.jit_dao_interface import IJITDao
from interfaces.jit_service_interface import IJITService


PENDING_JIT_STATUSES = ("EN_ATTENTE", "CONFIRMEE")
LOCKED_JIT_STATUS = "VERROUILLEE"
UNLOCKED_JIT_STATUS = "CONFIRMEE"


class JITService(IJITService):
    """Service pour l'agregation JIT des commandes."""

    def __init__(self, jit_dao: IJITDao) -> None:
        self.jit_dao = jit_dao

    def agreger_commandes(self, session: Session) -> ResultatAgregationJIT:
        """
        Agrege toutes les commandes confirmees et les abonnements actifs.
        Calcule les volumes avec buffer 10% et arrondit a la caisse entiere.
        """
        volumes_par_produit: Dict[int, Dict] = {}
        today = date.today()
        start_of_day = datetime.combine(today, time.min)
        end_of_day = datetime.combine(today, time.max)

        commandes = (
            session.query(Commande)
            .filter(
                Commande.statut.in_(PENDING_JIT_STATUSES),
                Commande.date_commande >= start_of_day,
                Commande.date_commande <= end_of_day,
            )
            .all()
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
                    volumes_par_produit[product_id] = {
                        "nom_fr": produit.nom_fr,
                        "nom_darija": produit.nom_darija,
                        "quantite_brute": 0.0,
                        "prix_kg": produit.prix_kg,
                        "unite": produit.unite,
                    }

                volumes_par_produit[product_id]["quantite_brute"] += quantite

        abonnements = (
            session.query(Abonnement)
            .filter(Abonnement.actif == True)
            .all()
        )
        nombre_abonnements = len(abonnements)

        for _abonnement in abonnements:
            # Placeholder: la contribution produit des abonnements n'est pas encore modelisee.
            pass

        buffer_perte = 0.10
        details_produits: List[DetailProduitJIT] = []
        volume_total = 0.0
        montant_total = 0.0

        for product_id, info in volumes_par_produit.items():
            quantite_brute = info["quantite_brute"]
            buffer = quantite_brute * buffer_perte
            volume_avec_buffer = quantite_brute + buffer
            volume_final = math.ceil(volume_avec_buffer)

            prix_kg = info["prix_kg"]
            sous_total = quantite_brute * prix_kg

            detail = DetailProduitJIT(
                product_id=product_id,
                nom_fr=info["nom_fr"],
                nom_darija=info["nom_darija"],
                quantite_brute_kg=round(quantite_brute, 2),
                buffer_perte_10_pct=round(buffer, 2),
                volume_total_kg=float(volume_final),
                prix_kg=prix_kg,
                sous_total=round(sous_total, 2),
                unite=info["unite"],
            )

            details_produits.append(detail)
            volume_total += volume_final
            montant_total += sous_total

        statut = "succès" if len(commandes) > 0 else "aucune_commande"
        message = None

        if len(commandes) == 0:
            message = "Aucune commande confirmee - annulation de tournee ?"
            statut = "aucune_commande"

        return ResultatAgregationJIT(
            nombre_commandes=len(commandes),
            nombre_abonnements=nombre_abonnements,
            volume_total_kg=round(volume_total, 2),
            details_produits=details_produits,
            montant_total=round(montant_total, 2),
            statut=statut,
            message=message,
        )

    def verrouiller_commandes(self, session: Session) -> int:
        """
        Verrouille toutes les commandes EN_ATTENTE ou CONFIRMEE.
        Retourne le nombre de commandes verrouillees.
        """
        try:
            today = date.today()
            start_of_day = datetime.combine(today, time.min)
            end_of_day = datetime.combine(today, time.max)

            commandes = (
                session.query(Commande)
                .filter(
                    Commande.statut.in_(PENDING_JIT_STATUSES),
                    Commande.date_commande >= start_of_day,
                    Commande.date_commande <= end_of_day,
                )
                .all()
            )

            nombre_verrouillees = 0
            for commande in commandes:
                setattr(commande, "statut", LOCKED_JIT_STATUS)  # type: ignore
                nombre_verrouillees += 1

            session.flush()
            return nombre_verrouillees
        except Exception as exc:
            print(f"Erreur lors du verrouillage des commandes: {exc}")
            raise

    def deverrouiller_commandes(self, session: Session) -> Dict:
        """
        Deverrouille toutes les commandes verrouillees par le JIT.
        Retourne le nombre et le detail des commandes rouvertes.
        """
        try:
            today = date.today()
            start_of_day = datetime.combine(today, time.min)
            end_of_day = datetime.combine(today, time.max)

            commandes = (
                session.query(Commande)
                .filter(
                    Commande.statut == LOCKED_JIT_STATUS,
                    Commande.date_commande >= start_of_day,
                    Commande.date_commande <= end_of_day,
                )
                .all()
            )

            commandes_deverrouillees = []
            for commande in commandes:
                statut_avant = str(commande.statut) if commande.statut else None
                setattr(commande, "statut", UNLOCKED_JIT_STATUS)  # type: ignore
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

    def executer_job_jit(self, session: Session) -> JITLogDTO:
        """
        Execute le job JIT complet:
        1. Agreger les commandes
        2. Verrouiller les commandes
        3. Creer un log avec la liste d'achats en base
        """
        try:
            print("Demarrage du job JIT d'agregation des commandes...")

            resultat = self.agreger_commandes(session)
            print(
                f"Agregation complete: {resultat.nombre_commandes} commandes, "
                f"{resultat.volume_total_kg} kg total"
            )

            if resultat.statut == "succès":
                nombre_verrouillees = self.verrouiller_commandes(session)
                print(f"{nombre_verrouillees} commandes verrouillees")

            details_json = {
                "produits": [
                    {
                        "product_id": detail.product_id,
                        "nom_fr": detail.nom_fr,
                        "quantite_brute_kg": detail.quantite_brute_kg,
                        "buffer_10_pct": detail.buffer_perte_10_pct,
                        "volume_final_kg": detail.volume_total_kg,
                        "prix_kg": detail.prix_kg,
                        "sous_total": detail.sous_total,
                    }
                    for detail in resultat.details_produits
                ]
            }

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
            print("Job JIT termine avec succes")

            return log or JITLogDTO(
                volume_total=resultat.volume_total_kg,
                nombre_commandes=resultat.nombre_commandes,
                nombre_abonnements=resultat.nombre_abonnements,
                statut="erreur",
                message_alerte="Erreur lors de la creation du log",
            )

        except Exception as exc:
            print(f"Erreur lors de l'execution du job JIT: {exc}")
            session.rollback()

            try:
                error_session = LocalSession()
                error_log = self.jit_dao.create_log(
                    error_session,
                    volume_total=0.0,
                    nombre_commandes=0,
                    nombre_abonnements=0,
                    statut="erreur",
                    message_alerte=f"Erreur: {exc}",
                )
                error_session.commit()
                error_session.close()
                return error_log or JITLogDTO(
                    volume_total=0.0,
                    nombre_commandes=0,
                    nombre_abonnements=0,
                    statut="erreur",
                    message_alerte=str(exc),
                )
            except Exception as log_error:
                print(f"Erreur lors de la creation du log d'erreur: {log_error}")
                return JITLogDTO(
                    volume_total=0.0,
                    nombre_commandes=0,
                    nombre_abonnements=0,
                    statut="erreur",
                    message_alerte=f"Erreur double: {exc} + {log_error}",
                )
