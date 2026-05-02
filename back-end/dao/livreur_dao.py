from datetime import datetime
from typing import Any, Iterable, Optional
from uuid import UUID

from sqlalchemy import Float, MetaData, Table, case, func, inspect, literal, select
from sqlalchemy.orm import Session

from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.delivery_event_entity import DeliveryEvent
from entities.ligne_panier_entity import LignePanier
from entities.livreur_entity import Livreur
from entities.notification_outbox_entity import NotificationOutbox
from entities.paiement_entity import Paiement
from entities.user_entity import User
from interfaces.livreur_dao_interface import ILivreurDao


class LivreurDaoBD(ILivreurDao):

    @staticmethod
    def _payment_validated_expression():
        return case(
            (Commande.payment_validated.is_(True), True),
            (Paiement.valide.is_(True), True),
            else_=False,
        )

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
                Commande.status_version.label("status_version"),
                Commande.enroute_at.label("enroute_at"),
                Commande.delivered_at.label("delivered_at"),
                Commande.absent_at.label("absent_at"),
                Commande.mode_paiement.label("mode_paiement"),
                Commande.montant_total.label("montant_total"),
                User.phone.label("client_phone"),
                self._payment_validated_expression().label("payment_validated"),
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
            .outerjoin(Paiement, Paiement.commande_id == Commande.id)
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

    def get_available_livreurs(self, session: Session) -> list[Livreur]:
        return (
            session.query(Livreur)
            .join(User, User.id == Livreur.user_id)
            .filter(Livreur.disponible.is_(True))
            .filter(func.upper(func.coalesce(User.role, "")) == "LIVREUR")
            .order_by(Livreur.user_id.asc())
            .all()
        )

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

    def get_commande_delivery_context(
        self,
        session: Session,
        livreur_id: int,
        commande_id: int,
    ) -> Optional[dict[str, Any]]:
        commande_statement = (
            select(Commande)
            .where(
                Commande.id == commande_id,
                Commande.livreur_id == livreur_id,
            )
            .with_for_update(of=Commande)
        )
        commande = session.execute(commande_statement).scalar_one_or_none()
        if commande is None:
            return None

        details_statement = (
            select(
                User.phone.label("client_phone"),
                self._payment_validated_expression().label("payment_validated"),
            )
            .select_from(Commande)
            .outerjoin(Client, Client.user_id == Commande.client_id)
            .outerjoin(User, User.id == Client.user_id)
            .outerjoin(Paiement, Paiement.commande_id == Commande.id)
            .where(Commande.id == commande_id)
        )
        details_row = session.execute(details_statement).first()

        return {
            "commande": commande,
            "client_phone": details_row.client_phone if details_row else None,
            "payment_validated": details_row.payment_validated if details_row else None,
        }

    def get_delivery_event_by_client_event_id(
        self,
        session: Session,
        client_event_id: UUID,
    ) -> Optional[DeliveryEvent]:
        statement = select(DeliveryEvent).where(DeliveryEvent.client_event_id == client_event_id)
        return session.execute(statement).scalar_one_or_none()

    def create_delivery_event(
        self,
        session: Session,
        **kwargs,
    ) -> DeliveryEvent:
        event = DeliveryEvent(**kwargs)
        session.add(event)
        session.flush()
        return event

    def create_notification_outbox(
        self,
        session: Session,
        *,
        outbox_type: str,
        payload: dict[str, Any],
    ) -> NotificationOutbox:
        outbox_entry = NotificationOutbox(type=outbox_type, payload=payload, status="PENDING")
        session.add(outbox_entry)
        session.flush()
        return outbox_entry

    def mark_cod_payment_validated(
        self,
        session: Session,
        *,
        commande_id: int,
        mode_paiement: Optional[str],
        montant_total: Optional[float],
    ) -> bool:
        statement = (
            select(Paiement)
            .where(Paiement.commande_id == commande_id)
            .with_for_update(of=Paiement)
        )
        commande = session.execute(
            select(Commande)
            .where(Commande.id == commande_id)
        ).scalar_one()

        paiement = session.execute(statement).scalar_one_or_none()
        commande_was_already_validated = commande.payment_validated is True
        commande.payment_validated = True

        if paiement is None:
            paiement = Paiement(
                commande_id=commande_id,
                methode=(mode_paiement or "COD"),
                montant=float(montant_total or 0.0),
                frais_cmi=0.0,
                montant_net=float(montant_total or 0.0),
                valide=True,
            )
            session.add(paiement)
            session.flush()
            return commande_was_already_validated

        was_already_validated = paiement.valide is True
        paiement.valide = True
        if paiement.methode in (None, ""):
            paiement.methode = mode_paiement or "COD"
        if paiement.montant is None:
            paiement.montant = float(montant_total or 0.0)
        if paiement.montant_net is None:
            paiement.montant_net = float(montant_total or 0.0)
        if paiement.frais_cmi is None:
            paiement.frais_cmi = 0.0
        session.flush()
        return was_already_validated or commande_was_already_validated

    def get_delivery_changes_since(
        self,
        session: Session,
        *,
        since: Optional[datetime],
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        statement = (
            select(
                DeliveryEvent.id.label("event_id"),
                DeliveryEvent.commande_id.label("commande_id"),
                DeliveryEvent.livreur_id.label("livreur_id"),
                DeliveryEvent.previous_status.label("previous_status"),
                DeliveryEvent.new_status.label("new_status"),
                DeliveryEvent.server_timestamp.label("server_timestamp"),
                DeliveryEvent.device_timestamp.label("device_timestamp"),
            )
            .order_by(DeliveryEvent.server_timestamp.asc())
            .limit(limit)
        )
        if since is not None:
            statement = statement.where(DeliveryEvent.server_timestamp > since)

        return [dict(row._mapping) for row in session.execute(statement).all()]

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
