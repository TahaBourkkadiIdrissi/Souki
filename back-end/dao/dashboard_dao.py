from datetime import date, datetime, timedelta

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from dto.dashboard_dto import (
    DashboardDTO,
    DashboardPaiementDTO,
    DashboardPointDTO,
    DashboardStatutDTO,
)
from entities.cod_confirmation_log_entity import CODConfirmationLog
from entities.commande_entity import Commande
from entities.jit_log_entity import JITLog
from entities.ligne_panier_entity import LignePanier
from entities.livreur_entity import Livreur
from entities.paiement_entity import Paiement
from entities.panier_entity import Panier
from entities.parrainage_entity import PARRAINAGE_CONVERTI, PARRAINAGE_EN_ATTENTE, Parrainage
from entities.product_entity import Product
from entities.tournee_entity import Tournee
from interfaces.client_admin_dao_interface import IClientAdminDao
from interfaces.client_blacklist_dao_interface import IClientBlacklistDao
from interfaces.dashboard_dao_interface import IDashboardDao


class DashboardDaoBD(IDashboardDao):

    def __init__(
        self,
        client_blacklist_dao: IClientBlacklistDao,
        client_admin_dao: IClientAdminDao,
    ) -> None:
        self.client_blacklist_dao = client_blacklist_dao
        self.client_admin_dao = client_admin_dao

    def get_dashboard(
        self,
        session: Session,
        *,
        periode: str,
        date_custom: str | None,
        date_debut: datetime,
        date_fin: datetime,
        prec_debut: datetime,
        prec_fin: datetime,
        today: date,
        curve_start_datetime: datetime,
        curve_end_datetime: datetime,
        is_today: bool = False,
    ) -> DashboardDTO:
        total_commandes = self._get_order_count(session, date_debut, date_fin)
        total_commandes_precedent = self._get_order_count(
            session,
            prec_debut,
            prec_fin,
        )
        status_counts = self._get_status_counts(session, date_debut, date_fin)
        commandes_livrees = status_counts.get("LIVRE", 0)
        commandes_absentes = status_counts.get("ABSENT", 0)
        commandes_livrees_precedent = self._get_order_count(
            session,
            prec_debut,
            prec_fin,
            status="LIVRE",
        )

        ca_total = self._get_total_revenue(session, date_debut, date_fin)
        ca_total_precedent = self._get_total_revenue(
            session,
            prec_debut,
            prec_fin,
        )
        payment_ca = self._get_revenue_by_payment(session, date_debut, date_fin)
        cod_counts = self._get_cod_counts(session, date_debut, date_fin)
        blacklist_counts = self.client_blacklist_dao.get_action_counts_by_period(
            session,
            date_debut,
            date_fin,
        )
        last_jit = self._get_last_jit(session)
        cod_total = cod_counts.get("CONFIRMEE_PAR_APPEL", 0) + cod_counts.get("ANNULEE", 0)
        # Source : is_blacklisted=True sur t_clients
        # Peut differer de /admin/blacklist si client blackliste sans log
        # Comportement voulu : source de verite = champ is_blacklisted
        clients_blacklistes = self.client_admin_dao.count_blacklisted_clients(session)

        marge_brute, taux_marge = self._get_gross_margin(session, date_debut, date_fin)
        marge_brute_precedent, _ = self._get_gross_margin(session, prec_debut, prec_fin)
        parrainages_en_attente, filleuls_convertis, credit_parrainage = self._get_parrainage_kpis(
            session,
            date_debut,
            date_fin,
        )

        return DashboardDTO(
            periode=periode,
            date_custom=date_custom,
            date_debut=date_debut,
            date_fin=date_fin,
            derniere_maj=datetime.now(),
            total_commandes=total_commandes,
            total_commandes_precedent=total_commandes_precedent,
            commandes_livrees=commandes_livrees,
            commandes_livrees_precedent=commandes_livrees_precedent,
            commandes_en_route=status_counts.get("EN_ROUTE", 0),
            commandes_annulees=status_counts.get("ANNULEE", 0),
            commandes_absentes=commandes_absentes,
            taux_livraison=round((commandes_livrees / total_commandes) * 100, 2) if total_commandes else 0.0,
            taux_absence=round((commandes_absentes / total_commandes) * 100, 2) if total_commandes else 0.0,
            ca_total=ca_total,
            ca_total_precedent=ca_total_precedent,
            ca_cod=payment_ca.get("COD", 0.0),
            ca_wallet=payment_ca.get("WALLET", 0.0),
            ca_cmi=payment_ca.get("CMI", 0.0),
            panier_moyen=round(ca_total / commandes_livrees, 2) if commandes_livrees else 0.0,
            panier_moyen_precedent=round(ca_total_precedent / commandes_livrees_precedent, 2)
            if commandes_livrees_precedent
            else 0.0,
            marge_brute=marge_brute,
            marge_brute_precedent=marge_brute_precedent,
            taux_marge=taux_marge,
            parrainages_en_attente=parrainages_en_attente,
            filleuls_convertis=filleuls_convertis,
            credit_parrainage_distribue=credit_parrainage,
            total_clients_actifs=self.client_admin_dao.count_active_clients(session),
            nouveaux_clients=self.client_admin_dao.count_new_clients(session, date_debut, date_fin),
            nouveaux_clients_precedent=self.client_admin_dao.count_new_clients(session, prec_debut, prec_fin),
            clients_blacklistes=clients_blacklistes,
            dernier_jit_statut=last_jit.statut if last_jit else None,
            dernier_jit_volume=float(last_jit.volume_total or 0.0) if last_jit else 0.0,
            dernier_jit_nb_commandes=int(last_jit.nombre_commandes or 0) if last_jit else 0,
            dernier_jit_date=last_jit.date_execution if last_jit else None,
            jit_execute_aujourdhui=self._get_jit_executed_today(session, today),
            livreurs_disponibles=self._get_available_livreurs(session),
            tournees_actives=self._get_active_tournees(session, today),
            cod_confirmes=cod_counts.get("CONFIRMEE_PAR_APPEL", 0),
            cod_annules=cod_counts.get("ANNULEE", 0),
            taux_confirmation_cod=round((cod_counts.get("CONFIRMEE_PAR_APPEL", 0) / cod_total) * 100, 2)
            if cod_total
            else 0.0,
            nouveaux_blacklistes=blacklist_counts.get("BLACKLISTED", 0),
            blacklists_leves=blacklist_counts.get("LIFTED", 0),
            courbe_ca=self._get_revenue_curve(
                session,
                curve_start_datetime,
                curve_end_datetime,
                is_today=is_today,
            ),
            repartition_statuts=self._get_status_repartition(status_counts, total_commandes),
            repartition_paiements=self._get_payment_repartition(session, date_debut, date_fin),
        )

    def _non_draft_filter(self):
        return func.upper(func.coalesce(Commande.statut, "")) != "BROUILLON"

    def _status_filter(self, status: str):
        return func.upper(func.coalesce(Commande.statut, "")) == status

    def _get_order_count(
        self,
        session: Session,
        start_datetime: datetime,
        end_datetime: datetime,
        status: str | None = None,
    ) -> int:
        query = session.query(func.count(Commande.id)).filter(
            Commande.date_commande >= start_datetime,
            Commande.date_commande <= end_datetime,
            self._non_draft_filter(),
        )
        if status:
            query = query.filter(self._status_filter(status))
        return int(query.scalar() or 0)

    def _get_status_counts(
        self, session: Session, start_datetime: datetime, end_datetime: datetime
    ) -> dict[str, int]:
        status_expr = func.upper(func.coalesce(Commande.statut, "INCONNU"))
        rows = (
            session.query(
                status_expr.label("statut"),
                func.count(Commande.id).label("count"),
            )
            .filter(
                Commande.date_commande >= start_datetime,
                Commande.date_commande <= end_datetime,
                self._non_draft_filter(),
            )
            .group_by(status_expr)
            .all()
        )
        return {str(row.statut): int(row.count or 0) for row in rows}

    def _get_status_repartition(
        self,
        status_counts: dict[str, int],
        total_commandes: int,
    ) -> list[DashboardStatutDTO]:
        return [
            DashboardStatutDTO(
                statut=statut,
                count=count,
                pourcentage=round((count / total_commandes) * 100, 2) if total_commandes else 0.0,
            )
            for statut, count in sorted(status_counts.items(), key=lambda item: (-item[1], item[0]))
        ]

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
                Commande.date_commande <= end_datetime,
                self._non_draft_filter(),
                self._status_filter("LIVRE"),
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
                Commande.date_commande <= end_datetime,
                self._non_draft_filter(),
                self._status_filter("LIVRE"),
            )
            .group_by(mode_expr)
            .all()
        )
        return {str(row.mode): float(row.montant or 0.0) for row in rows}

    def _get_gross_margin(
        self, session: Session, start_datetime: datetime, end_datetime: datetime
    ) -> tuple[float, float]:
        row = (
            session.query(
                func.coalesce(func.sum(LignePanier.sous_total), 0.0),
                func.coalesce(
                    func.sum(
                        LignePanier.quantite_kg * func.coalesce(Product.prix_gros_saisi, 0.0)
                    ),
                    0.0,
                ),
            )
            .select_from(Commande)
            .join(Panier, Panier.id == Commande.panier_id)
            .join(LignePanier, LignePanier.panier_id == Panier.id)
            .join(Product, Product.id == LignePanier.produit_id)
            .filter(
                Commande.date_commande >= start_datetime,
                Commande.date_commande <= end_datetime,
                self._non_draft_filter(),
                self._status_filter("LIVRE"),
            )
            .first()
        )
        revenue = float(row[0] or 0.0) if row else 0.0
        cost = float(row[1] or 0.0) if row else 0.0
        margin = round(revenue - cost, 2)
        rate = round((margin / revenue) * 100, 2) if revenue else 0.0
        return margin, rate

    def _get_parrainage_kpis(
        self, session: Session, start_datetime: datetime, end_datetime: datetime
    ) -> tuple[int, int, float]:
        en_attente = int(
            session.query(func.count(Parrainage.id))
            .filter(Parrainage.statut == PARRAINAGE_EN_ATTENTE)
            .scalar()
            or 0
        )
        convertis = int(
            session.query(func.count(Parrainage.id))
            .filter(
                Parrainage.statut == PARRAINAGE_CONVERTI,
                Parrainage.converted_at >= start_datetime,
                Parrainage.converted_at <= end_datetime,
            )
            .scalar()
            or 0
        )
        credit = float(
            session.query(
                func.coalesce(
                    func.sum(
                        func.coalesce(Parrainage.credit_parrain, 0.0)
                        + func.coalesce(Parrainage.credit_filleul, 0.0)
                    ),
                    0.0,
                )
            )
            .filter(
                Parrainage.statut == PARRAINAGE_CONVERTI,
                Parrainage.converted_at >= start_datetime,
                Parrainage.converted_at <= end_datetime,
            )
            .scalar()
            or 0.0
        )
        return en_attente, convertis, round(credit, 2)

    def _get_last_jit(self, session: Session) -> JITLog | None:
        return session.query(JITLog).order_by(JITLog.date_execution.desc(), JITLog.id.desc()).first()

    def _get_jit_executed_today(self, session: Session, today: date) -> bool:
        count = int(
            session.query(func.count(JITLog.id))
            .filter(
                func.date(JITLog.date_execution) == today,
                func.lower(JITLog.statut).in_(["succès", "succes", "success"]),
            )
            .scalar()
            or 0
        )
        return count > 0

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
            .filter(
                CODConfirmationLog.created_at >= start_datetime,
                CODConfirmationLog.created_at <= end_datetime,
            )
            .group_by(status_expr)
            .all()
        )
        return {str(row.statut): int(row.count or 0) for row in rows}

    def _get_revenue_curve(
        self,
        session: Session,
        start_datetime: datetime,
        end_datetime: datetime,
        is_today: bool = False,
    ) -> list[DashboardPointDTO]:
        if is_today:
            hour_expr = func.date_part("hour", Commande.date_commande)
            rows = (
                session.query(
                    hour_expr.label("heure"),
                    func.coalesce(func.sum(Commande.montant_total), 0).label("ca"),
                    func.count(Commande.id).label("nb_commandes"),
                )
                .filter(
                    Commande.date_commande >= start_datetime,
                    Commande.date_commande <= end_datetime,
                    self._non_draft_filter(),
                    self._status_filter("LIVRE"),
                )
                .group_by(hour_expr)
                .order_by(hour_expr.asc())
                .all()
            )
            rows_by_hour = {
                int(row.heure): {
                    "ca": float(row.ca or 0.0),
                    "nb_commandes": int(row.nb_commandes or 0),
                }
                for row in rows
            }
            return [
                DashboardPointDTO(
                    date=f"{hour:02d}h00",
                    ca=rows_by_hour.get(hour, {}).get("ca", 0.0),
                    nb_commandes=rows_by_hour.get(hour, {}).get("nb_commandes", 0),
                )
                for hour in range(9, 21)
            ]

        date_expr = func.date(Commande.date_commande)
        rows = (
            session.query(
                date_expr.label("date"),
                func.coalesce(func.sum(Commande.montant_total), 0).label("ca"),
                func.count(Commande.id).label("nb_commandes"),
            )
            .filter(
                Commande.date_commande >= start_datetime,
                Commande.date_commande <= end_datetime,
                self._non_draft_filter(),
                self._status_filter("LIVRE"),
            )
            .group_by(date_expr)
            .order_by(date_expr.asc())
            .all()
        )
        rows_by_date = {
            str(row.date): DashboardPointDTO(
                date=str(row.date),
                ca=float(row.ca or 0.0),
                nb_commandes=int(row.nb_commandes or 0),
            )
            for row in rows
        }
        days_count = max((end_datetime.date() - start_datetime.date()).days + 1, 0)
        return [
            rows_by_date.get(
                str(start_datetime.date() + timedelta(days=offset)),
                DashboardPointDTO(date=str(start_datetime.date() + timedelta(days=offset))),
            )
            for offset in range(days_count)
        ]

    def _get_payment_repartition(
        self, session: Session, start_datetime: datetime, end_datetime: datetime
    ) -> list[DashboardPaiementDTO]:
        mode_expr = self._payment_mode_expr()
        rows = (
            session.query(
                mode_expr.label("mode"),
                func.count(Commande.id).label("count"),
                func.coalesce(func.sum(Commande.montant_total), 0).label("montant"),
            )
            .select_from(Commande)
            .outerjoin(Paiement, Paiement.commande_id == Commande.id)
            .filter(
                Commande.date_commande >= start_datetime,
                Commande.date_commande <= end_datetime,
                self._non_draft_filter(),
                self._status_filter("LIVRE"),
            )
            .group_by(mode_expr)
            .order_by(func.sum(Commande.montant_total).desc(), mode_expr.asc())
            .all()
        )
        total_montant = self._get_total_revenue(session, start_datetime, end_datetime)
        return [
            DashboardPaiementDTO(
                mode=str(row.mode),
                count=int(row.count or 0),
                montant=float(row.montant or 0.0),
                pourcentage=round((float(row.montant or 0.0) / total_montant) * 100, 2)
                if total_montant
                else 0.0,
            )
            for row in rows
        ]
