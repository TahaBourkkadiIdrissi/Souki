from typing import Any, Iterable, Optional

from sqlalchemy import Float, MetaData, Table, func, inspect, literal, select, update
from sqlalchemy.orm import Session

from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.ligne_panier_entity import LignePanier
from entities.user_entity import User
from interfaces.livreur_dao_interface import ILivreurDao


class LivreurDaoBD(ILivreurDao):

    def get_tournee_rows(
        self,
        session: Session,
        livreur_id: int,
        visible_statuses: Iterable[str],
    ) -> list[dict[str, Any]]:
        address_table = Table("t_addresses", MetaData(), autoload_with=session.bind)
        address_alias = address_table.alias("delivery_address")
        address_ordering = [address_table.c.id.desc()]
        if "is_default" in address_table.c:
            address_ordering.insert(0, address_table.c.is_default.desc())

        ranked_address_subquery = (
            select(
                address_table.c.user_id.label("user_id"),
                address_table.c.id.label("address_id"),
                func.row_number()
                .over(
                    partition_by=address_table.c.user_id,
                    order_by=address_ordering,
                )
                .label("row_rank"),
            )
            .subquery()
        )
        preferred_address_subquery = (
            select(
                ranked_address_subquery.c.user_id,
                ranked_address_subquery.c.address_id,
            )
            .where(ranked_address_subquery.c.row_rank == 1)
            .subquery()
        )
        colis_subquery = (
            select(
                LignePanier.panier_id.label("panier_id"),
                func.count(LignePanier.id).label("colis_count"),
            )
            .group_by(LignePanier.panier_id)
            .subquery()
        )

        latitude_column, longitude_column = self._resolve_coordinate_columns(session)
        latitude_selectable = (
            address_alias.c[latitude_column].cast(Float).label("lat")
            if latitude_column and longitude_column
            else literal(None).label("lat")
        )
        longitude_selectable = (
            address_alias.c[longitude_column].cast(Float).label("lng")
            if latitude_column and longitude_column
            else literal(None).label("lng")
        )

        normalized_statuses = [status.upper() for status in visible_statuses]
        status_expression = func.upper(func.coalesce(Commande.statut, ""))

        statement = (
            select(
                Commande.id.label("commande_id"),
                Commande.creneau_livraison.label("creneau_livraison"),
                Commande.statut.label("statut"),
                Commande.mode_paiement.label("mode_paiement"),
                Commande.montant_total.label("montant_total"),
                User.phone.label("client_phone"),
                address_alias.c.street.label("street"),
                address_alias.c.neighborhood.label("neighborhood"),
                address_alias.c.details.label("details"),
                func.coalesce(colis_subquery.c.colis_count, 0).label("colis_count"),
                latitude_selectable,
                longitude_selectable,
            )
            .select_from(Commande)
            .join(Client, Client.user_id == Commande.client_id)
            .join(User, User.id == Client.user_id)
            .outerjoin(
                preferred_address_subquery,
                preferred_address_subquery.c.user_id == Client.user_id,
            )
            .outerjoin(
                address_alias,
                address_alias.c.id == preferred_address_subquery.c.address_id,
            )
            .outerjoin(colis_subquery, colis_subquery.c.panier_id == Commande.panier_id)
            .where(
                Commande.livreur_id == livreur_id,
                status_expression.in_(normalized_statuses),
            )
            .order_by(Commande.creneau_livraison.asc(), Commande.id.asc())
        )

        return [dict(row._mapping) for row in session.execute(statement).all()]

    def start_tournee(
        self,
        session: Session,
        livreur_id: int,
        pending_statuses: Iterable[str],
        started_status: str,
    ) -> int:
        normalized_statuses = [status.upper() for status in pending_statuses]
        statement = (
            update(Commande)
            .where(
                Commande.livreur_id == livreur_id,
                func.upper(func.coalesce(Commande.statut, "")).in_(normalized_statuses),
            )
            .values(statut=started_status)
        )
        result = session.execute(statement)
        return int(result.rowcount or 0)

    def count_by_statuses(
        self,
        session: Session,
        livreur_id: int,
        statuses: Iterable[str],
    ) -> int:
        normalized_statuses = [status.upper() for status in statuses]
        statement = (
            select(func.count(Commande.id))
            .where(
                Commande.livreur_id == livreur_id,
                func.upper(func.coalesce(Commande.statut, "")).in_(normalized_statuses),
            )
        )
        return int(session.execute(statement).scalar_one() or 0)

    def _resolve_coordinate_columns(
        self,
        session: Session,
    ) -> tuple[Optional[str], Optional[str]]:
        inspector = inspect(session.bind)
        columns = {
            column["name"].lower(): column["name"]
            for column in inspector.get_columns("t_addresses")
        }
        supported_pairs = (
            ("latitude", "longitude"),
            ("lat", "lng"),
            ("lat", "lon"),
        )
        for latitude_name, longitude_name in supported_pairs:
            if latitude_name in columns and longitude_name in columns:
                return columns[latitude_name], columns[longitude_name]
        return None, None
