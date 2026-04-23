from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Iterable, Optional
from uuid import UUID

from sqlalchemy.orm import Session


class ILivreurDao(ABC):

    @abstractmethod
    def get_tournee_rows(
        self,
        session: Session,
        livreur_id: int,
        visible_statuses: Iterable[str],
    ) -> list[dict[str, Any]]:
        pass

    @abstractmethod
    def count_by_statuses(
        self,
        session: Session,
        livreur_id: int,
        statuses: Iterable[str],
    ) -> int:
        pass

    @abstractmethod
    def get_commande_delivery_context(
        self,
        session: Session,
        livreur_id: int,
        commande_id: int,
    ) -> Optional[dict[str, Any]]:
        pass

    @abstractmethod
    def get_delivery_event_by_client_event_id(
        self,
        session: Session,
        client_event_id: UUID,
    ):
        pass

    @abstractmethod
    def create_delivery_event(
        self,
        session: Session,
        **kwargs,
    ):
        pass

    @abstractmethod
    def create_notification_outbox(
        self,
        session: Session,
        *,
        outbox_type: str,
        payload: dict[str, Any],
    ):
        pass

    @abstractmethod
    def mark_cod_payment_validated(
        self,
        session: Session,
        *,
        commande_id: int,
        mode_paiement: Optional[str],
        montant_total: Optional[float],
    ) -> bool:
        pass

    @abstractmethod
    def get_delivery_changes_since(
        self,
        session: Session,
        *,
        since: Optional[datetime],
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        pass
