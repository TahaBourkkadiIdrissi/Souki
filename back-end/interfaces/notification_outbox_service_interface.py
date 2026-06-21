from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy.orm import Session


class INotificationOutboxService(ABC):

    @abstractmethod
    def queue_backoffice_alert(
        self,
        session: Session,
        *,
        event: str,
        payload: dict[str, Any],
        channel: str,
        priority: str,
    ) -> None:
        pass
