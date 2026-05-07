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
)
from entities.address_entity import Address
from entities.client_blacklist_log_entity import ClientBlacklistLog
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

    def _month_bounds(self, year: int, month: int) -> tuple[datetime, datetime]:
        start_date = datetime.combine(datetime(year, month, 1).date(), time.min)
        if month == 12:
            end_date = datetime.combine(datetime(year + 1, 1, 1).date(), time.min)
        else:
            end_date = datetime.combine(datetime(year, month + 1, 1).date(), time.min)
        return start_date, end_date
