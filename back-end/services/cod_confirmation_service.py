from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from config import LocalSession
from dto.commande_dto import CommandeCODDemainDTO, ConfirmationCODResponseDTO
from interfaces.cod_confirmation_log_dao_interface import ICODConfirmationLogDao
from interfaces.cod_confirmation_service_interface import ICODConfirmationService
from interfaces.commande_dao_interface import ICommandeVocaleDao

NON_CONFIRMEE = "NON_CONFIRMEE"
CONFIRMEE_PAR_APPEL = "CONFIRMEE_PAR_APPEL"
ANNULEE = "ANNULEE"


class CODConfirmationService(ICODConfirmationService):

    def __init__(
        self,
        commande_dao: ICommandeVocaleDao,
        cod_confirmation_log_dao: ICODConfirmationLogDao,
        session: Optional[Session] = None,
    ) -> None:
        self.commande_dao = commande_dao
        self.cod_confirmation_log_dao = cod_confirmation_log_dao
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

    def get_commandes_cod_demain(self) -> List[CommandeCODDemainDTO]:
        session = self._ensure_session()
        rows = self.commande_dao.get_commandes_cod_verrouillees(session)
        latest_logs = self.cod_confirmation_log_dao.get_latest_logs_by_commande_ids(
            session,
            [row["id"] for row in rows],
        )

        commandes = []
        for row in rows:
            latest_log = latest_logs.get(row["id"])
            commandes.append(
                CommandeCODDemainDTO(
                    id=row["id"],
                    nom_client=row.get("nom_client"),
                    telephone=row.get("telephone"),
                    adresse=row.get("adresse"),
                    montant=row.get("montant"),
                    creneau_livraison=row.get("creneau_livraison"),
                    statut_confirmation_cod=str(latest_log.statut) if latest_log else NON_CONFIRMEE,
                )
            )

        return commandes

    def update_confirmation_cod(
        self,
        commande_id: int,
        statut: str,
        admin_id: int,
    ) -> ConfirmationCODResponseDTO:
        session = self._ensure_session()
        normalized_statut = (statut or "").strip().upper()

        if normalized_statut not in {CONFIRMEE_PAR_APPEL, ANNULEE}:
            raise HTTPException(status_code=400, detail="Statut de confirmation COD invalide.")

        try:
            commande = self.commande_dao.get_commande_for_cod_update(session, commande_id)
            if not commande:
                raise HTTPException(status_code=404, detail="Commande introuvable.")

            mode_paiement = str(commande.mode_paiement) if commande.mode_paiement else None
            if not self._is_cod_mode(mode_paiement):
                raise HTTPException(status_code=409, detail="Cette commande n'est pas en paiement a la livraison.")

            current_status = str(commande.statut or "").strip().upper()
            if current_status not in {"VERROUILLEE", "ANNULEE"}:
                raise HTTPException(
                    status_code=409,
                    detail="Seules les commandes COD verrouillees par le JIT peuvent etre traitees ici.",
                )

            if current_status == "ANNULEE" and normalized_statut != ANNULEE:
                raise HTTPException(status_code=409, detail="Cette commande COD est deja annulee.")

            if normalized_statut == ANNULEE:
                self.commande_dao.annuler_commande_cod(session, commande)

            log = self.cod_confirmation_log_dao.create_log(
                session,
                commande_id=commande_id,
                admin_id=admin_id,
                statut=normalized_statut,
            )
            session.commit()

            return ConfirmationCODResponseDTO(
                commande_id=commande_id,
                statut_confirmation_cod=normalized_statut,
                commande_statut=str(commande.statut) if commande.statut else None,
                logged_at=log.created_at,  # type: ignore
                message=(
                    "Commande COD confirmee par appel."
                    if normalized_statut == CONFIRMEE_PAR_APPEL
                    else "Commande COD annulee et retiree de la tournee livreur."
                ),
            )
        except HTTPException:
            session.rollback()
            raise
        except Exception as exc:
            session.rollback()
            raise HTTPException(status_code=500, detail="Erreur interne lors de la confirmation COD.") from exc

    def _is_cod_mode(self, mode_paiement: Optional[str]) -> bool:
        normalized_mode = (mode_paiement or "").strip().casefold()
        return normalized_mode in {"cod", "cash", "especes", "especes_livraison", "cash_on_delivery"}
