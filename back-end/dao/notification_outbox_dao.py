from typing import Any

from sqlalchemy.orm import Session

from entities.notification_outbox_entity import NotificationOutbox
from interfaces.notification_outbox_dao_interface import INotificationOutboxDao


class NotificationOutboxDaoBD(INotificationOutboxDao):

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
