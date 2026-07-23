from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from entities.push_subscription_entity import PushSubscription
from interfaces.push_subscription_dao_interface import IPushSubscriptionDao


class PushSubscriptionDaoBD(IPushSubscriptionDao):

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
        subscription = session.execute(
            select(PushSubscription).where(PushSubscription.endpoint == endpoint)
        ).scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if subscription is None:
            subscription = PushSubscription(
                user_id=user_id,
                endpoint=endpoint,
                p256dh=p256dh,
                auth=auth,
                user_agent=user_agent,
                created_at=now,
                last_seen_at=now,
            )
            session.add(subscription)
        else:
            # Le meme endpoint peut revenir sur un autre compte (appareil
            # partage, changement d'utilisateur) : on le rattache au dernier
            # connecte plutot que de creer un doublon impossible (index unique).
            subscription.user_id = user_id
            subscription.p256dh = p256dh
            subscription.auth = auth
            subscription.user_agent = user_agent
            subscription.last_seen_at = now
            subscription.revoked_at = None

        session.flush()
        return subscription

    def get_active_subscriptions(self, session: Session, user_id: int) -> list[PushSubscription]:
        return list(
            session.execute(
                select(PushSubscription)
                .where(
                    PushSubscription.user_id == user_id,
                    PushSubscription.revoked_at.is_(None),
                )
                .order_by(PushSubscription.last_seen_at.desc())
            ).scalars()
        )

    def count_active_subscriptions(self, session: Session, user_id: int) -> int:
        return int(
            session.execute(
                select(func.count(PushSubscription.id)).where(
                    PushSubscription.user_id == user_id,
                    PushSubscription.revoked_at.is_(None),
                )
            ).scalar_one()
        )

    def revoke_by_endpoint(self, session: Session, *, endpoint: str, user_id: int | None = None) -> bool:
        query = select(PushSubscription).where(PushSubscription.endpoint == endpoint)
        if user_id is not None:
            query = query.where(PushSubscription.user_id == user_id)

        subscription = session.execute(query).scalar_one_or_none()
        if subscription is None or subscription.revoked_at is not None:
            return False

        subscription.revoked_at = datetime.now(timezone.utc)
        session.flush()
        return True
