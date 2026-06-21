from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy.orm import Session

from entities.notification_outbox_entity import NotificationOutbox


class INotificationOutboxDao(ABC):

    @abstractmethod
    def create_notification_outbox(
        self,
        session: Session,
        *,
        outbox_type: str,
        payload: dict[str, Any],
    ) -> NotificationOutbox:
        pass
