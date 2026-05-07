from datetime import date, datetime

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from dto.dashboard_dto import (
    CourbeCADTO,
    DashboardDTO,
    RepartitionPaiementDTO,
    RepartitionStatutDTO,
)
from entities.client_blacklist_log_entity import ClientBlacklistLog
from entities.client_entity import Client
from entities.cod_confirmation_log_entity import CODConfirmationLog
from entities.commande_entity import Commande
from entities.jit_log_entity import JITLog
from entities.livreur_entity import Livreur
from entities.paiement_entity import Paiement
from entities.tournee_entity import Tournee
from entities.user_entity import User
from entities.wallet_entity import Wallet
from interfaces.dashboard_dao_interface import IDashboardDao


class DashboardDaoBD(IDashboardDao):

    def get_dashboard(
        self,
        session: Session,
        *,
        start_datetime: datetime,
        end_datetime: datetime,
        today: date,
        curve_start_datetime: datetime,
        curve_end_datetime: datetime,
    ) -> DashboardDTO:
        status_counts = self._get_status_counts(session, start_datetime, end_datetime)
        total_commandes = sum(status_counts.values())
        commandes_livrees = status_counts.get("LIVRE", 0)

        ca_total = self._get_total_revenue(session, start_datetime, end_datetime)
        payment_ca = self._get_revenue_by_payment(session, start_datetime, end_datetime)
        client_counts = self._get_client_counts(session, start_datetime, end_datetime)
        cod_counts = self._get_cod_counts(session, start_datetime, end_datetime)
        blacklist_counts = self._get_blacklist_counts(session, start_datetime, end_datetime)
        last_jit = self._get_last_jit(session)

        return DashboardDTO(
            total_commandes=total_commandes,
            commandes_livrees=commandes_livrees,
            commandes_en_route=status_counts.get("EN_ROUTE", 0),
            commandes_annulees=status_counts.get("ANNULEE", 0),
            commandes_absentes=status_counts.get("ABSENT", 0),
            taux_livraison=round((commandes_livrees / total_commandes) * 100, 2) if total_commandes else 0.0,
            ca_total=ca_total,
            ca_cod=payment_ca.get("COD", 0.0),
            ca_wallet=payment_ca.get("WALLET", 0.0),
            ca_cmi=payment_ca.get("CMI", 0.0),
            total_clients_actifs=client_counts.get("actifs", 0),
            nouveaux_clients=client_counts.get("nouveaux", 0),
            clients_blacklistes=client_counts.get("blacklistes", 0),
            dernier_jit_statut=last_jit.statut if last_jit else None,
            dernier_jit_volume=float(last_jit.volume_total or 0.0) if last_jit else 0.0,
            dernier_jit_date=last_jit.date_execution if last_jit else None,
            livreurs_disponibles=self._get_available_livreurs(session),
            tournees_actives=self._get_active_tournees(session, today),
            cod_confirmes=cod_counts.get("CONFIRMEE_PAR_APPEL", 0),
            cod_annules=cod_counts.get("ANNULEE", 0),
            nouveaux_blacklistes=blacklist_counts.get("BLACKLISTED", 0),
            blacklists_leves=blacklist_counts.get("LIFTED", 0),
            total_soldes_wallets=self._get_wallet_balance_total(session),
            courbe_ca=self._get_revenue_curve(session, curve_start_datetime, curve_end_datetime),
            repartition_statuts=[
                RepartitionStatutDTO(statut=statut, count=count)
                for statut, count in status_counts.items()
            ],
            repartition_paiements=self._get_payment_repartition(session, start_datetime, end_datetime),
        )

    def _get_status_counts(
        self, session: Session, start_datetime: datetime, end_datetime: datetime
    ) -> dict[str, int]:
        status_expr = func.upper(func.coalesce(Commande.statut, "INCONNU"))
        rows = (
            session.query(
                status_expr.label("statut"),
                func.count(Commande.id).label("count"),
            )
            .filter(Commande.date_commande >= start_datetime, Commande.date_commande < end_datetime)
            .group_by(status_expr)
            .all()
        )
        return {str(row.statut): int(row.count or 0) for row in rows}

    def _payment_mode_expr(self):
        raw_mode = func.upper(func.coalesce(Commande.mode_paiement, Paiement.methode, "INCONNU"))
        return case((raw_mode == "", "INCONNU"), else_=raw_mode)

    def _get_total_revenue(
        self, session: Session, start_datetime: datetime, end_datetime: datetime
    ) -> float:
        return float(
            session.query(func.coalesce(func.sum(Commande.montant_total), 0))
            .filter(
                Commande.date_commande >= start_datetime,
                Commande.date_commande < end_datetime,
                func.upper(func.coalesce(Commande.statut, "")) == "LIVRE",
            )
            .scalar()
            or 0.0
        )

    def _get_revenue_by_payment(
        self, session: Session, start_datetime: datetime, end_datetime: datetime
    ) -> dict[str, float]:
        mode_expr = self._payment_mode_expr()
        rows = (
            session.query(
                mode_expr.label("mode"),
                func.coalesce(func.sum(Commande.montant_total), 0).label("montant"),
            )
            .select_from(Commande)
            .outerjoin(Paiement, Paiement.commande_id == Commande.id)
            .filter(
                Commande.date_commande >= start_datetime,
                Commande.date_commande < end_datetime,
                func.upper(func.coalesce(Commande.statut, "")) == "LIVRE",
            )
            .group_by(mode_expr)
            .all()
        )
        return {str(row.mode): float(row.montant or 0.0) for row in rows}

    def _get_client_counts(
        self, session: Session, start_datetime: datetime, end_datetime: datetime
    ) -> dict[str, int]:
        active_clients = int(
            session.query(func.count(Client.user_id))
            .join(User, User.id == Client.user_id)
            .filter(User.is_active.is_(True), func.upper(func.coalesce(User.role, "")) == "CLIENT")
            .scalar()
            or 0
        )
        new_clients = int(
            session.query(func.count(Client.user_id))
            .join(User, User.id == Client.user_id)
            .filter(
                User.created_at >= start_datetime,
                User.created_at < end_datetime,
                func.upper(func.coalesce(User.role, "")) == "CLIENT",
            )
            .scalar()
            or 0
        )
        blacklisted_clients = int(
            session.query(func.count(Client.user_id))
            .filter(Client.is_blacklisted.is_(True))
            .scalar()
            or 0
        )
        return {
            "actifs": active_clients,
            "nouveaux": new_clients,
            "blacklistes": blacklisted_clients,
        }

    def _get_last_jit(self, session: Session) -> JITLog | None:
        return session.query(JITLog).order_by(JITLog.date_execution.desc(), JITLog.id.desc()).first()

    def _get_available_livreurs(self, session: Session) -> int:
        return int(
            session.query(func.count(Livreur.user_id))
            .filter(Livreur.disponible.is_(True))
            .scalar()
            or 0
        )

    def _get_active_tournees(self, session: Session, today: date) -> int:
        return int(
            session.query(func.count(Tournee.id))
            .filter(
                Tournee.date_tournee == today,
                func.upper(func.coalesce(Tournee.statut, "")) != "TERMINEE",
            )
            .scalar()
            or 0
        )

    def _get_cod_counts(
        self, session: Session, start_datetime: datetime, end_datetime: datetime
    ) -> dict[str, int]:
        status_expr = func.upper(func.coalesce(CODConfirmationLog.statut, "INCONNU"))
        rows = (
            session.query(
                status_expr.label("statut"),
                func.count(CODConfirmationLog.id).label("count"),
            )
            .filter(CODConfirmationLog.created_at >= start_datetime, CODConfirmationLog.created_at < end_datetime)
            .group_by(status_expr)
            .all()
        )
        return {str(row.statut): int(row.count or 0) for row in rows}

    def _get_blacklist_counts(
        self, session: Session, start_datetime: datetime, end_datetime: datetime
    ) -> dict[str, int]:
        action_expr = func.upper(func.coalesce(ClientBlacklistLog.action, "INCONNU"))
        rows = (
            session.query(
                action_expr.label("action"),
                func.count(ClientBlacklistLog.id).label("count"),
            )
            .filter(ClientBlacklistLog.created_at >= start_datetime, ClientBlacklistLog.created_at < end_datetime)
            .group_by(action_expr)
            .all()
        )
        return {str(row.action): int(row.count or 0) for row in rows}

    def _get_wallet_balance_total(self, session: Session) -> float:
        return float(session.query(func.coalesce(func.sum(Wallet.solde), 0)).scalar() or 0.0)

    def _get_revenue_curve(
        self, session: Session, start_datetime: datetime, end_datetime: datetime
    ) -> list[CourbeCADTO]:
        date_expr = func.date(Commande.date_commande)
        rows = (
            session.query(
                date_expr.label("date"),
                func.coalesce(func.sum(Commande.montant_total), 0).label("ca"),
                func.count(Commande.id).label("nb_commandes"),
            )
            .filter(
                Commande.date_commande >= start_datetime,
                Commande.date_commande < end_datetime,
                func.upper(func.coalesce(Commande.statut, "")) == "LIVRE",
            )
            .group_by(date_expr)
            .order_by(date_expr.asc())
            .all()
        )
        return [
            CourbeCADTO(date=str(row.date), ca=float(row.ca or 0.0), nb_commandes=int(row.nb_commandes or 0))
            for row in rows
        ]

    def _get_payment_repartition(
        self, session: Session, start_datetime: datetime, end_datetime: datetime
    ) -> list[RepartitionPaiementDTO]:
        mode_expr = self._payment_mode_expr()
        rows = (
            session.query(
                mode_expr.label("mode"),
                func.count(Commande.id).label("count"),
                func.coalesce(func.sum(Commande.montant_total), 0).label("montant"),
            )
            .select_from(Commande)
            .outerjoin(Paiement, Paiement.commande_id == Commande.id)
            .filter(Commande.date_commande >= start_datetime, Commande.date_commande < end_datetime)
            .group_by(mode_expr)
            .order_by(func.count(Commande.id).desc(), mode_expr.asc())
            .all()
        )
        return [
            RepartitionPaiementDTO(
                mode=str(row.mode),
                count=int(row.count or 0),
                montant=float(row.montant or 0.0),
            )
            for row in rows
        ]
