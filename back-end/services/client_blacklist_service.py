from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from dto.client_blacklist_dto import ClientBlacklistDTO, BlacklistReportDTO
from entities.client_entity import Client
from entities.user_entity import User
from interfaces.client_blacklist_dao_interface import IClientBlacklistDao
from interfaces.client_blacklist_service_interface import IClientBlacklistService


class ClientBlacklistService(IClientBlacklistService):

    def __init__(self, client_blacklist_dao: IClientBlacklistDao) -> None:
        self.client_blacklist_dao = client_blacklist_dao

    def blacklist_after_refusal(
        self,
        session: Session,
        client_id: int,
        commande_id: int,
        livreur_id: int,
        motif: Optional[str] = None,
    ) -> None:
        motif = motif or "Refus de livraison"

        try:
            client = session.get(Client, client_id)
            if client is None:
                raise HTTPException(status_code=404, detail="Client introuvable.")

            user = session.get(User, client_id)
            client.is_blacklisted = True
            self.client_blacklist_dao.flush(session)

            self.client_blacklist_dao.create_log(
                session=session,
                client_id=client_id,
                action="BLACKLISTED",
                source="AUTO_REFUS",
                phone_snapshot=user.phone if user else None,
                reason=motif,
                commande_id=commande_id,
                livreur_id=livreur_id,
            )
            session.commit()
        except Exception:
            session.rollback()
            raise

    def blacklist_manual(
        self,
        session: Session,
        client_id: int,
        admin_id: int,
        reason: str,
    ) -> None:
        normalized_reason = (reason or "").strip()
        if not normalized_reason:
            raise HTTPException(status_code=400, detail="Motif obligatoire.")

        try:
            client = session.get(Client, client_id)
            if client is None:
                raise HTTPException(status_code=404, detail="Client introuvable.")

            user = session.get(User, client_id)
            client.is_blacklisted = True
            self.client_blacklist_dao.flush(session)

            self.client_blacklist_dao.create_log(
                session=session,
                client_id=client_id,
                action="BLACKLISTED",
                source="ADMIN",
                phone_snapshot=user.phone if user else None,
                reason=normalized_reason,
                admin_id=admin_id,
            )
            session.commit()
        except Exception:
            session.rollback()
            raise

    def lift_blacklist(
        self,
        session: Session,
        client_id: int,
        admin_id: int,
        reason: Optional[str] = None,
    ) -> None:
        try:
            client = session.get(Client, client_id)
            if client is None:
                raise HTTPException(status_code=404, detail="Client introuvable.")

            user = session.get(User, client_id)
            client.is_blacklisted = False
            self.client_blacklist_dao.flush(session)

            self.client_blacklist_dao.create_log(
                session=session,
                client_id=client_id,
                action="LIFTED",
                source="ADMIN",
                phone_snapshot=user.phone if user else None,
                reason=reason,
                admin_id=admin_id,
            )
            session.commit()
        except Exception:
            session.rollback()
            raise

    def get_blacklisted_clients(
        self, session: Session
    ) -> List[ClientBlacklistDTO]:
        return self.client_blacklist_dao.get_blacklisted_clients(session)

    def get_monthly_report(
        self, session: Session, year: int, month: int
    ) -> BlacklistReportDTO:
        if month < 1 or month > 12:
            raise HTTPException(status_code=400, detail="Mois invalide.")
        return self.client_blacklist_dao.get_monthly_report(session, year, month)
