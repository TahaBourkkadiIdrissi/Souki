from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from dto.client_blacklist_dto import (
    BlacklistReportDTO,
    BlacklistStatusDTO,
    ClientBlacklistDTO,
    PendingLiftRequestDTO,
)
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

        client = session.get(Client, client_id)
        if client is None:
            raise HTTPException(status_code=404, detail="Client introuvable.")

        user = session.get(User, client_id)
        client.is_blacklisted = True
        self.client_blacklist_dao.flush(session)

        # Pas de commit/rollback ici : cette methode est appelee au milieu de la
        # transaction de LivreurService (refus de livraison). C'est l'appelant qui
        # commit (ou rollback) a la fin, pour que refus + blacklist + notification
        # soient atomiques (tout ou rien).
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

    def request_lift(
        self,
        session: Session,
        client_id: int,
        motif: str,
    ) -> None:
        normalized_motif = (motif or "").strip()
        if not normalized_motif:
            raise HTTPException(status_code=400, detail="Motif obligatoire.")

        try:
            client = session.get(Client, client_id)
            if not client or not client.is_blacklisted:
                raise HTTPException(status_code=400, detail="Client non blackliste.")

            pending = self.client_blacklist_dao.get_lift_requests_pending(session)
            if any(request.client_id == client_id for request in pending):
                raise HTTPException(status_code=400, detail="Demande deja en attente.")

            self.client_blacklist_dao.create_lift_request(session, client_id, normalized_motif)
            session.commit()
        except Exception:
            session.rollback()
            raise

    def reject_lift(
        self,
        session: Session,
        client_id: int,
        admin_id: int,
        motif: str,
    ) -> None:
        normalized_motif = (motif or "").strip()
        if not normalized_motif:
            raise HTTPException(status_code=400, detail="Motif obligatoire.")

        try:
            pending = self.client_blacklist_dao.get_lift_requests_pending(session)
            if not any(request.client_id == client_id for request in pending):
                raise HTTPException(status_code=400, detail="Aucune demande en attente.")

            self.client_blacklist_dao.create_lift_rejection(
                session=session,
                client_id=client_id,
                admin_id=admin_id,
                motif=normalized_motif,
            )
            session.commit()
        except Exception:
            session.rollback()
            raise

    def get_blacklist_status(
        self,
        session: Session,
        client_id: int,
    ) -> BlacklistStatusDTO:
        client = session.get(Client, client_id)
        last_log = self.client_blacklist_dao.get_last_blacklist_action(session, client_id)
        lift_notification_seen = False
        if last_log and last_log.action == "LIFTED":
            lift_notification_seen = self.client_blacklist_dao.is_lift_notification_seen(
                session,
                client_id,
                int(last_log.id),
            )
        return BlacklistStatusDTO(
            is_blacklisted=bool(client.is_blacklisted) if client else False,
            last_action=last_log.action if last_log else None,
            last_reason=last_log.reason if last_log else None,
            last_date=last_log.created_at if last_log else None,
            lift_notification_seen=lift_notification_seen,
        )

    def get_pending_lift_requests(
        self, session: Session
    ) -> List[PendingLiftRequestDTO]:
        return self.client_blacklist_dao.get_lift_requests_pending(session)

    def mark_lift_notification_seen(
        self,
        session: Session,
        client_id: int,
    ) -> None:
        try:
            last_log = self.client_blacklist_dao.get_last_blacklist_action(session, client_id)
            if not last_log or last_log.action != "LIFTED":
                return

            self.client_blacklist_dao.mark_lift_notification_seen(
                session,
                client_id,
                int(last_log.id),
            )
            session.commit()
        except Exception:
            session.rollback()
            raise

    def get_monthly_report(
        self, session: Session, year: int, month: int
    ) -> BlacklistReportDTO:
        if month < 1 or month > 12:
            raise HTTPException(status_code=400, detail="Mois invalide.")
        return self.client_blacklist_dao.get_monthly_report(session, year, month)
