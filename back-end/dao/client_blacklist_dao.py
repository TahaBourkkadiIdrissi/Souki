from datetime import datetime, time
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, aliased

from dto.client_blacklist_dto import (
    BlacklistCommandeRefuseeDTO,
    BlacklistParClientDTO,
    BlacklistParLivreurDTO,
    BlacklistParQuartierDTO,
    BlacklistReportDTO,
    ClientBlacklistDTO,
    PendingLiftRequestDTO,
)
from entities.address_entity import Address
from entities.client_blacklist_log_entity import ClientBlacklistLog
from entities.client_blacklist_notification_read_entity import ClientBlacklistNotificationRead
from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.livreur_entity import Livreur
from entities.user_entity import User
from interfaces.client_blacklist_dao_interface import IClientBlacklistDao


class ClientBlacklistDaoBD(IClientBlacklistDao):

    def flush(self, session: Session) -> None:
        session.flush()

    def create_log(
        self,
        session: Session,
        client_id: int,
        action: str,
        source: str,
        phone_snapshot: Optional[str] = None,
        reason: Optional[str] = None,
        commande_id: Optional[int] = None,
        livreur_id: Optional[int] = None,
        admin_id: Optional[int] = None,
    ) -> None:
        log = ClientBlacklistLog(
            client_id=client_id,
            phone_snapshot=phone_snapshot,
            action=action,
            reason=reason,
            source=source,
            commande_id=commande_id,
            livreur_id=livreur_id,
            admin_id=admin_id,
        )
        session.add(log)
        session.flush()

    def get_blacklisted_clients(
        self, session: Session
    ) -> List[ClientBlacklistDTO]:
        latest_blacklisted_subquery = (
            session.query(
                ClientBlacklistLog.client_id.label("client_id"),
                func.max(ClientBlacklistLog.id).label("latest_log_id"),
            )
            .filter(ClientBlacklistLog.action == "BLACKLISTED")
            .group_by(ClientBlacklistLog.client_id)
            .subquery()
        )

        livreur_user = aliased(User)
        admin_user = aliased(User)

        rows = (
            session.query(
                Client.user_id.label("client_id"),
                User.email.label("email"),
                User.phone.label("phone"),
                Client.is_blacklisted.label("is_blacklisted"),
                ClientBlacklistLog.created_at.label("date_blacklist"),
                ClientBlacklistLog.reason.label("motif"),
                ClientBlacklistLog.source.label("source"),
                ClientBlacklistLog.commande_id.label("commande_id"),
                Commande.statut.label("commande_statut"),
                Commande.date_commande.label("commande_date"),
                func.coalesce(Commande.montant_total, 0).label("montant_perdu"),
                livreur_user.email.label("livreur_email"),
                livreur_user.phone.label("livreur_phone"),
                admin_user.email.label("admin_email"),
                admin_user.phone.label("admin_phone"),
            )
            .select_from(ClientBlacklistLog)
            .join(
                latest_blacklisted_subquery,
                latest_blacklisted_subquery.c.latest_log_id == ClientBlacklistLog.id,
            )
            .join(Client, Client.user_id == ClientBlacklistLog.client_id)
            .join(User, User.id == Client.user_id)
            .outerjoin(Commande, Commande.id == ClientBlacklistLog.commande_id)
            .outerjoin(Livreur, Livreur.user_id == ClientBlacklistLog.livreur_id)
            .outerjoin(livreur_user, livreur_user.id == Livreur.user_id)
            .outerjoin(admin_user, admin_user.id == ClientBlacklistLog.admin_id)
            .filter(Client.is_blacklisted.is_(True))
            .order_by(ClientBlacklistLog.created_at.desc(), ClientBlacklistLog.id.desc())
            .all()
        )

        return [
            ClientBlacklistDTO(
                client_id=int(row.client_id),
                email=row.email,
                phone=row.phone,
                is_blacklisted=bool(row.is_blacklisted),
                date_blacklist=row.date_blacklist,
                motif=row.motif,
                source=row.source,
                livreur_nom=row.livreur_email or row.livreur_phone,
                commande_id=int(row.commande_id) if row.commande_id is not None else None,
                commande_statut=row.commande_statut,
                commande_date=row.commande_date,
                montant_perdu=float(row.montant_perdu or 0.0),
                admin_nom=row.admin_email or row.admin_phone,
            )
            for row in rows
        ]

    def create_lift_request(
        self,
        session: Session,
        client_id: int,
        motif: str,
    ) -> ClientBlacklistLog:
        log = ClientBlacklistLog(
            client_id=client_id,
            action="LIFT_REQUESTED",
            reason=motif,
            source="CLIENT",
        )
        session.add(log)
        session.flush()
        return log

    def get_lift_requests_pending(
        self, session: Session
    ) -> List[PendingLiftRequestDTO]:
        latest_request_subquery = (
            session.query(
                ClientBlacklistLog.client_id.label("client_id"),
                func.max(ClientBlacklistLog.id).label("request_id"),
            )
            .filter(ClientBlacklistLog.action == "LIFT_REQUESTED")
            .group_by(ClientBlacklistLog.client_id)
            .subquery()
        )

        resolved_after_subquery = (
            session.query(ClientBlacklistLog.client_id)
            .join(
                latest_request_subquery,
                latest_request_subquery.c.client_id == ClientBlacklistLog.client_id,
            )
            .filter(ClientBlacklistLog.action.in_(["LIFTED", "LIFT_REJECTED"]))
            .filter(ClientBlacklistLog.id > latest_request_subquery.c.request_id)
            .subquery()
        )

        rows = (
            session.query(
                ClientBlacklistLog.id.label("log_id"),
                ClientBlacklistLog.client_id.label("client_id"),
                User.email.label("client_email"),
                User.phone.label("phone"),
                ClientBlacklistLog.reason.label("motif"),
                ClientBlacklistLog.created_at.label("created_at"),
            )
            .select_from(ClientBlacklistLog)
            .join(
                latest_request_subquery,
                latest_request_subquery.c.request_id == ClientBlacklistLog.id,
            )
            .join(Client, Client.user_id == ClientBlacklistLog.client_id)
            .join(User, User.id == Client.user_id)
            .filter(Client.is_blacklisted.is_(True))
            .filter(ClientBlacklistLog.client_id.notin_(resolved_after_subquery))
            .order_by(ClientBlacklistLog.created_at.desc(), ClientBlacklistLog.id.desc())
            .all()
        )

        return [
            PendingLiftRequestDTO(
                log_id=int(row.log_id),
                client_id=int(row.client_id),
                client_label=row.client_email or row.phone,
                phone=row.phone,
                motif=row.motif,
                created_at=row.created_at,
            )
            for row in rows
        ]

    def create_lift_rejection(
        self,
        session: Session,
        client_id: int,
        admin_id: int,
        motif: str,
    ) -> None:
        log = ClientBlacklistLog(
            client_id=client_id,
            action="LIFT_REJECTED",
            reason=motif,
            admin_id=admin_id,
            source="ADMIN",
        )
        session.add(log)
        session.flush()

    def get_last_blacklist_action(
        self,
        session: Session,
        client_id: int,
    ) -> Optional[ClientBlacklistLog]:
        return (
            session.query(ClientBlacklistLog)
            .filter(ClientBlacklistLog.client_id == client_id)
            .order_by(ClientBlacklistLog.created_at.desc(), ClientBlacklistLog.id.desc())
            .first()
        )

    def is_lift_notification_seen(
        self,
        session: Session,
        client_id: int,
        blacklist_log_id: int,
    ) -> bool:
        return (
            session.query(ClientBlacklistNotificationRead.id)
            .filter(ClientBlacklistNotificationRead.client_id == client_id)
            .filter(ClientBlacklistNotificationRead.blacklist_log_id == blacklist_log_id)
            .first()
            is not None
        )

    def mark_lift_notification_seen(
        self,
        session: Session,
        client_id: int,
        blacklist_log_id: int,
    ) -> None:
        if self.is_lift_notification_seen(session, client_id, blacklist_log_id):
            return

        read = ClientBlacklistNotificationRead(
            client_id=client_id,
            blacklist_log_id=blacklist_log_id,
        )
        session.add(read)
        session.flush()

    def get_monthly_report(
        self, session: Session, year: int, month: int
    ) -> BlacklistReportDTO:
        start_date, end_date = self._month_bounds(year, month)
        base_filters = (
            ClientBlacklistLog.action == "BLACKLISTED",
            ClientBlacklistLog.source == "AUTO_REFUS",
            ClientBlacklistLog.created_at >= start_date,
            ClientBlacklistLog.created_at < end_date,
        )

        total_refus = int(
            session.query(func.count(ClientBlacklistLog.id))
            .filter(*base_filters)
            .scalar()
            or 0
        )
        total_perte = float(
            session.query(func.coalesce(func.sum(Commande.montant_total), 0))
            .select_from(ClientBlacklistLog)
            .outerjoin(Commande, Commande.id == ClientBlacklistLog.commande_id)
            .filter(*base_filters)
            .scalar()
            or 0.0
        )

        par_client_rows = (
            session.query(
                ClientBlacklistLog.client_id.label("client_id"),
                User.email.label("email"),
                User.phone.label("phone"),
                func.count(ClientBlacklistLog.id).label("nb_refus"),
                func.coalesce(func.sum(Commande.montant_total), 0).label("montant_perdu"),
            )
            .select_from(ClientBlacklistLog)
            .join(User, User.id == ClientBlacklistLog.client_id)
            .outerjoin(Commande, Commande.id == ClientBlacklistLog.commande_id)
            .filter(*base_filters)
            .group_by(ClientBlacklistLog.client_id, User.email, User.phone)
            .order_by(func.count(ClientBlacklistLog.id).desc(), ClientBlacklistLog.client_id.asc())
            .all()
        )

        livreur_user = aliased(User)
        par_livreur_rows = (
            session.query(
                ClientBlacklistLog.livreur_id.label("livreur_id"),
                livreur_user.email.label("livreur_email"),
                livreur_user.phone.label("livreur_phone"),
                func.count(ClientBlacklistLog.id).label("nb_refus"),
            )
            .select_from(ClientBlacklistLog)
            .outerjoin(Livreur, Livreur.user_id == ClientBlacklistLog.livreur_id)
            .outerjoin(livreur_user, livreur_user.id == Livreur.user_id)
            .filter(*base_filters)
            .group_by(ClientBlacklistLog.livreur_id, livreur_user.email, livreur_user.phone)
            .order_by(func.count(ClientBlacklistLog.id).desc(), ClientBlacklistLog.livreur_id.asc())
            .all()
        )

        address_subquery = (
            session.query(
                Address.user_id.label("user_id"),
                func.max(Address.id).label("address_id"),
            )
            .group_by(Address.user_id)
            .subquery()
        )

        par_quartier_rows = (
            session.query(
                Address.neighborhood.label("quartier"),
                func.count(ClientBlacklistLog.id).label("nb_refus"),
                func.coalesce(func.sum(Commande.montant_total), 0).label("montant_perdu"),
            )
            .select_from(ClientBlacklistLog)
            .outerjoin(Commande, Commande.id == ClientBlacklistLog.commande_id)
            .outerjoin(address_subquery, address_subquery.c.user_id == ClientBlacklistLog.client_id)
            .outerjoin(Address, Address.id == address_subquery.c.address_id)
            .filter(*base_filters)
            .group_by(Address.neighborhood)
            .order_by(func.count(ClientBlacklistLog.id).desc(), Address.neighborhood.asc())
            .all()
        )

        commande_address_subquery = (
            session.query(
                Address.user_id.label("user_id"),
                func.max(Address.id).label("address_id"),
            )
            .group_by(Address.user_id)
            .subquery()
        )

        commandes_refusees_rows = (
            session.query(
                ClientBlacklistLog.id.label("log_id"),
                ClientBlacklistLog.commande_id.label("commande_id"),
                ClientBlacklistLog.client_id.label("client_id"),
                ClientBlacklistLog.created_at.label("date_refus"),
                ClientBlacklistLog.reason.label("motif"),
                User.email.label("client_email"),
                User.phone.label("client_phone"),
                Commande.date_commande.label("date_commande"),
                Commande.statut.label("statut_commande"),
                func.coalesce(Commande.montant_total, 0).label("montant_perdu"),
                livreur_user.email.label("livreur_email"),
                livreur_user.phone.label("livreur_phone"),
                Address.neighborhood.label("quartier"),
            )
            .select_from(ClientBlacklistLog)
            .join(User, User.id == ClientBlacklistLog.client_id)
            .outerjoin(Commande, Commande.id == ClientBlacklistLog.commande_id)
            .outerjoin(Livreur, Livreur.user_id == ClientBlacklistLog.livreur_id)
            .outerjoin(livreur_user, livreur_user.id == Livreur.user_id)
            .outerjoin(commande_address_subquery, commande_address_subquery.c.user_id == ClientBlacklistLog.client_id)
            .outerjoin(Address, Address.id == commande_address_subquery.c.address_id)
            .filter(*base_filters)
            .order_by(ClientBlacklistLog.created_at.desc(), ClientBlacklistLog.id.desc())
            .all()
        )

        return BlacklistReportDTO(
            mois=month,
            annee=year,
            total_refus=total_refus,
            total_perte=total_perte,
            par_client=[
                BlacklistParClientDTO(
                    client_id=int(row.client_id),
                    email=row.email,
                    phone=row.phone,
                    nb_refus=int(row.nb_refus or 0),
                    montant_perdu=float(row.montant_perdu or 0.0),
                )
                for row in par_client_rows
            ],
            par_livreur=[
                BlacklistParLivreurDTO(
                    livreur_id=int(row.livreur_id or 0),
                    livreur_nom=row.livreur_email or row.livreur_phone,
                    nb_refus=int(row.nb_refus or 0),
                )
                for row in par_livreur_rows
            ],
            par_quartier=[
                BlacklistParQuartierDTO(
                    quartier=row.quartier,
                    nb_refus=int(row.nb_refus or 0),
                    montant_perdu=float(row.montant_perdu or 0.0),
                )
                for row in par_quartier_rows
            ],
            commandes_refusees=[
                BlacklistCommandeRefuseeDTO(
                    log_id=int(row.log_id),
                    commande_id=int(row.commande_id) if row.commande_id is not None else None,
                    client_id=int(row.client_id),
                    client_label=row.client_email or row.client_phone,
                    phone=row.client_phone,
                    date_refus=row.date_refus,
                    date_commande=row.date_commande,
                    statut_commande=row.statut_commande,
                    montant_perdu=float(row.montant_perdu or 0.0),
                    livreur_nom=row.livreur_email or row.livreur_phone,
                    quartier=row.quartier,
                    motif=row.motif,
                )
                for row in commandes_refusees_rows
            ],
        )

    def get_action_counts_by_period(
        self,
        session: Session,
        start_datetime: datetime,
        end_datetime: datetime,
    ) -> dict[str, int]:
        action_expr = func.upper(func.coalesce(ClientBlacklistLog.action, "INCONNU"))
        rows = (
            session.query(
                action_expr.label("action"),
                func.count(ClientBlacklistLog.id).label("count"),
            )
            .filter(
                ClientBlacklistLog.created_at >= start_datetime,
                ClientBlacklistLog.created_at <= end_datetime,
            )
            .group_by(action_expr)
            .all()
        )
        return {str(row.action): int(row.count or 0) for row in rows}

    def _month_bounds(self, year: int, month: int) -> tuple[datetime, datetime]:
        start_date = datetime.combine(datetime(year, month, 1).date(), time.min)
        if month == 12:
            end_date = datetime.combine(datetime(year + 1, 1, 1).date(), time.min)
        else:
            end_date = datetime.combine(datetime(year, month + 1, 1).date(), time.min)
        return start_date, end_date
