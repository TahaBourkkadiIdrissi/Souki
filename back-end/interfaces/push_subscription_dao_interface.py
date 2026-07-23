from abc import ABC, abstractmethod

from sqlalchemy.orm import Session

from entities.push_subscription_entity import PushSubscription


class IPushSubscriptionDao(ABC):

    @abstractmethod
    def upsert_subscription(
        self,
        session: Session,
        *,
        user_id: int,
        endpoint: str,
        p256dh: str,
        auth: str,
        user_agent: str | None,
    ) -> PushSubscription:
        pass

    @abstractmethod
    def get_active_subscriptions(self, session: Session, user_id: int) -> list[PushSubscription]:
        pass

    @abstractmethod
    def count_active_subscriptions(self, session: Session, user_id: int) -> int:
        pass

    @abstractmethod
    def revoke_by_endpoint(self, session: Session, *, endpoint: str, user_id: int | None = None) -> bool:
        pass
