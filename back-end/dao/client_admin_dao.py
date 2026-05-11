from datetime import datetime
from math import ceil
from typing import Dict, Optional

from sqlalchemy import String, and_, cast, func, or_
from sqlalchemy.orm import Session

from dto.client_admin_dto import AdminClientDTO, AdminClientsPageDTO
from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.user_entity import User
from interfaces.client_admin_dao_interface import IClientAdminDao


class ClientAdminDaoBD(IClientAdminDao):

    def count_active_clients(self, session: Session) -> int:
        return int(
            session.query(func.count(Client.user_id))
            .join(User, User.id == Client.user_id)
            .filter(
                User.is_active.is_(True),
                func.upper(func.coalesce(User.role, "")) == "CLIENT",
            )
            .scalar()
            or 0
        )

    def count_new_clients(
        self,
        session: Session,
        start_datetime: datetime,
        end_datetime: datetime,
    ) -> int:
        return int(
            session.query(func.count(Client.user_id))
            .join(User, User.id == Client.user_id)
            .filter(
                User.created_at >= start_datetime,
                User.created_at <= end_datetime,
                func.upper(func.coalesce(User.role, "")) == "CLIENT",
            )
            .scalar()
            or 0
        )

    def count_blacklisted_clients(self, session: Session) -> int:
        return int(
            session.query(func.count(Client.user_id))
            .filter(Client.is_blacklisted.is_(True))
            .scalar()
            or 0
        )

    def get_clients_page(
        self,
        session: Session,
        *,
        search: Optional[str],
        page: int,
        page_size: int,
        blacklisted: Optional[bool],
    ) -> AdminClientsPageDTO:
        query = (
            session.query(
                Client.user_id.label("client_id"),
                User.email.label("email"),
                User.phone.label("phone"),
                Client.is_blacklisted.label("is_blacklisted"),
                User.created_at.label("date_inscription"),
            )
            .join(User, User.id == Client.user_id)
        )

        normalized_search = (search or "").strip()
        if normalized_search:
            search_like = f"%{normalized_search}%"
            search_filters = [
                User.email.ilike(search_like),
                User.phone.ilike(search_like),
                cast(Client.user_id, String).ilike(search_like),
            ]
            first_name_column = getattr(User, "first_name", None)
            last_name_column = getattr(User, "last_name", None)
            if first_name_column is not None:
                search_filters.append(first_name_column.ilike(search_like))
            if last_name_column is not None:
                search_filters.append(last_name_column.ilike(search_like))
            query = query.filter(or_(*search_filters))

        if blacklisted is not None:
            query = query.filter(Client.is_blacklisted.is_(blacklisted))

        total = int(query.count() or 0)
        filtered_client_ids_subquery = query.with_entities(Client.user_id.label("client_id")).subquery()
        totals_row = (
            session.query(func.count(Commande.id))
            .add_columns(func.coalesce(func.sum(Commande.montant_total), 0))
            .join(filtered_client_ids_subquery, filtered_client_ids_subquery.c.client_id == Commande.client_id)
            .filter(func.upper(func.coalesce(Commande.statut, "")) != "BROUILLON")
            .one()
        )
        total_commandes = int(totals_row[0] or 0)
        montant_total_global = float(totals_row[1] or 0.0)
        rows = (
            query.order_by(User.created_at.desc(), Client.user_id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        client_ids = [int(row.client_id) for row in rows]
        stats_by_client = self._get_order_stats(session, client_ids)
        favorite_payment_by_client = self._get_favorite_payment_modes(session, client_ids)

        return AdminClientsPageDTO(
            items=[
                AdminClientDTO(
                    client_id=int(row.client_id),
                    email=row.email,
                    phone=row.phone,
                    nb_commandes=stats_by_client.get(int(row.client_id), {}).get("nb_commandes", 0),
                    montant_total=stats_by_client.get(int(row.client_id), {}).get("montant_total", 0.0),
                    mode_paiement_favori=favorite_payment_by_client.get(int(row.client_id)),
                    is_blacklisted=bool(row.is_blacklisted),
                    date_inscription=row.date_inscription,
                )
                for row in rows
            ],
            total=total,
            total_commandes=total_commandes,
            montant_total_global=montant_total_global,
            page=page,
            page_size=page_size,
            total_pages=ceil(total / page_size) if total else 0,
        )

    def _get_order_stats(self, session: Session, client_ids: list[int]) -> Dict[int, dict]:
        if not client_ids:
            return {}

        rows = (
            session.query(
                Commande.client_id.label("client_id"),
                func.count(Commande.id).label("nb_commandes"),
                func.coalesce(func.sum(Commande.montant_total), 0).label("montant_total"),
            )
            .filter(Commande.client_id.in_(client_ids))
            .filter(func.upper(func.coalesce(Commande.statut, "")) != "BROUILLON")
            .group_by(Commande.client_id)
            .all()
        )

        return {
            int(row.client_id): {
                "nb_commandes": int(row.nb_commandes or 0),
                "montant_total": float(row.montant_total or 0.0),
            }
            for row in rows
            if row.client_id is not None
        }

    def _get_favorite_payment_modes(self, session: Session, client_ids: list[int]) -> Dict[int, str]:
        if not client_ids:
            return {}

        count_label = func.count(Commande.id).label("mode_count")
        payment_counts_subquery = (
            session.query(
                Commande.client_id.label("client_id"),
                Commande.mode_paiement.label("mode_paiement"),
                count_label,
            )
            .filter(Commande.client_id.in_(client_ids))
            .filter(Commande.mode_paiement.isnot(None))
            .filter(func.upper(func.coalesce(Commande.statut, "")) != "BROUILLON")
            .group_by(Commande.client_id, Commande.mode_paiement)
            .subquery()
        )
        max_counts_subquery = (
            session.query(
                payment_counts_subquery.c.client_id.label("client_id"),
                func.max(payment_counts_subquery.c.mode_count).label("max_mode_count"),
            )
            .group_by(payment_counts_subquery.c.client_id)
            .subquery()
        )
        rows = (
            session.query(
                payment_counts_subquery.c.client_id.label("client_id"),
                payment_counts_subquery.c.mode_paiement.label("mode_paiement"),
            )
            .join(
                max_counts_subquery,
                and_(
                    max_counts_subquery.c.client_id == payment_counts_subquery.c.client_id,
                    max_counts_subquery.c.max_mode_count == payment_counts_subquery.c.mode_count,
                ),
            )
            .order_by(payment_counts_subquery.c.client_id.asc(), payment_counts_subquery.c.mode_paiement.asc())
            .all()
        )

        favorites: Dict[int, str] = {}
        for row in rows:
            client_id = int(row.client_id)
            if client_id not in favorites and row.mode_paiement:
                favorites[client_id] = str(row.mode_paiement)

        return favorites
