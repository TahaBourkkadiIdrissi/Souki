from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from interfaces.notification_outbox_dao_interface import INotificationOutboxDao
from interfaces.notification_outbox_service_interface import INotificationOutboxService


class NotificationOutboxService(INotificationOutboxService):

    def __init__(self, notification_outbox_dao: INotificationOutboxDao) -> None:
        self.notification_outbox_dao = notification_outbox_dao

    def queue_backoffice_alert(
        self,
        session: Session,
        *,
        event: str,
        payload: dict[str, Any],
        channel: str,
        priority: str,
    ) -> None:
        self.notification_outbox_dao.create_notification_outbox(
            session=session,
            outbox_type="WEBSOCKET",
            payload={
                **payload,
                "event": event,
                "channel": channel,
                "priority": priority,
                "server_timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
