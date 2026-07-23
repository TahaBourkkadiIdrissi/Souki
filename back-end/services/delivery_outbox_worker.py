"""Worker de depilement de t_notification_outbox.

Depile les notifications en attente et les livre sur leur canal (EMAIL via
Resend, PUSH via VAPID, SMS via l'adaptateur configure). Les echecs temporaires
sont reprogrammes avec un backoff exponentiel ; les echecs definitifs
(destinataire invalide, canal non configure) sont marques SKIPPED sans retry.

Lance en tache periodique par le scheduler ; `run_forever()` permet aussi de
l'executer comme processus autonome (`python -m services.delivery_outbox_worker`).
"""

import json
import logging
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from config import LocalSession
from dao.push_subscription_dao import PushSubscriptionDaoBD
from entities.notification_outbox_entity import NotificationOutbox
from services.email_delivery_service import EmailDeliveryException, EmailDeliveryService
from services.notification_catalog import CHANNEL_EMAIL, CHANNEL_PUSH
from services.web_push_service import PushSubscriptionGone, WebPushError, web_push_service

logger = logging.getLogger("souki.outbox")

# Ce worker ne livre que les canaux sortants qu'il sait joindre. Les lignes
# WEBSOCKET (temps reel back-office, servi independamment par DeliveryEvent) et
# les eventuels vestiges d'autres canaux ne lui appartiennent pas : il ne doit
# ni les consommer ni journaliser leur charge utile (destinataires en clair).
DELIVERABLE_CHANNELS = (CHANNEL_EMAIL, CHANNEL_PUSH)

BATCH_SIZE = 50
MAX_ATTEMPTS = 5
# Delais avant la tentative n+1 : 1 min, 5 min, 15 min, 1 h.
BACKOFF_SECONDS = (60, 300, 900, 3600)


class NotificationSkipped(Exception):
    """Echec definitif : inutile de reessayer (canal inactif, cible disparue)."""


class DeliveryOutboxWorker:

    def __init__(
        self,
        poll_interval_seconds: float = 1.0,
        email_service: EmailDeliveryService | None = None,
        push_subscription_dao: PushSubscriptionDaoBD | None = None,
    ) -> None:
        self.poll_interval_seconds = poll_interval_seconds
        self.email_service = email_service or EmailDeliveryService()
        self.push_subscription_dao = push_subscription_dao or PushSubscriptionDaoBD()

    def run_forever(self) -> None:
        while True:
            self.run_once()
            time.sleep(self.poll_interval_seconds)

    def run_once(self) -> dict[str, int]:
        counters = {"sent": 0, "retried": 0, "failed": 0, "skipped": 0}
        session = LocalSession()
        try:
            for entry in self._claim_pending(session):
                try:
                    self._dispatch(session, entry)
                except NotificationSkipped as exc:
                    entry.status = "SKIPPED"
                    entry.last_error = str(exc)[:500]
                    counters["skipped"] += 1
                except Exception as exc:
                    self._schedule_retry(entry, exc)
                    counters["failed" if entry.status == "FAILED" else "retried"] += 1
                else:
                    entry.status = "SENT"
                    entry.sent_at = datetime.now(timezone.utc)
                    entry.last_error = None
                    counters["sent"] += 1

            session.commit()
        except Exception as exc:
            session.rollback()
            logger.error("[OUTBOX] Cycle interrompu (%s)", type(exc).__name__)
        finally:
            session.close()

        return counters

    # --- Selection ----------------------------------------------------------

    def _claim_pending(self, session: Session) -> list[NotificationOutbox]:
        now = datetime.now(timezone.utc)
        return list(
            session.execute(
                select(NotificationOutbox)
                .where(
                    NotificationOutbox.status == "PENDING",
                    NotificationOutbox.type.in_(DELIVERABLE_CHANNELS),
                    or_(
                        NotificationOutbox.next_attempt_at.is_(None),
                        NotificationOutbox.next_attempt_at <= now,
                    ),
                )
                .order_by(NotificationOutbox.created_at.asc(), NotificationOutbox.id.asc())
                .limit(BATCH_SIZE)
                # skip_locked : plusieurs instances de l'API peuvent tourner en
                # parallele sans jamais livrer deux fois la meme entree.
                .with_for_update(skip_locked=True)
            ).scalars()
        )

    def _schedule_retry(self, entry: NotificationOutbox, exc: Exception) -> None:
        attempts = int(entry.attempts or 0) + 1
        entry.attempts = attempts
        entry.last_error = f"{type(exc).__name__}: {exc}"[:500]

        if attempts >= MAX_ATTEMPTS:
            entry.status = "FAILED"
            logger.error(
                "[OUTBOX] Abandon apres %s tentatives (id=%s, canal=%s, event=%s)",
                attempts,
                entry.id,
                entry.type,
                entry.event,
            )
            return

        delay = BACKOFF_SECONDS[min(attempts - 1, len(BACKOFF_SECONDS) - 1)]
        entry.next_attempt_at = datetime.now(timezone.utc) + timedelta(seconds=delay)
        entry.status = "PENDING"

    # --- Livraison ----------------------------------------------------------

    def _dispatch(self, session: Session, entry: NotificationOutbox) -> None:
        payload = entry.payload if isinstance(entry.payload, dict) else json.loads(entry.payload)
        channel = (entry.type or "").upper()

        if channel == CHANNEL_EMAIL:
            self._deliver_email(entry, payload)
        elif channel == CHANNEL_PUSH:
            self._deliver_push(session, entry, payload)
        else:
            # Garde-fou : _claim_pending filtre deja sur DELIVERABLE_CHANNELS, donc
            # on n'arrive ici que par accident. On ignore sans journaliser la charge
            # utile (elle peut contenir un destinataire en clair).
            raise NotificationSkipped(f"Canal non deliverable par ce worker: {channel}")

    def _deliver_email(self, entry: NotificationOutbox, payload: dict) -> None:
        recipient = payload.get("recipient")
        if not recipient:
            raise NotificationSkipped("Destinataire email absent")
        if not self.email_service.is_resend_configured():
            raise NotificationSkipped("Canal EMAIL non configure (RESEND_API_KEY)")

        try:
            self.email_service.send_notification_email(
                recipient=str(recipient),
                subject=str(payload.get("subject") or payload.get("title") or "SOUKI"),
                title=str(payload.get("title") or "SOUKI"),
                body=str(payload.get("body") or ""),
                url=str(payload.get("url") or "/"),
                cta_label=payload.get("cta_label"),
                idempotency_key=entry.dedupe_key,
            )
        except EmailDeliveryException as exc:
            raise RuntimeError(str(exc)) from exc

    def _deliver_push(self, session: Session, entry: NotificationOutbox, payload: dict) -> None:
        if not web_push_service.is_configured():
            raise NotificationSkipped("Canal PUSH non configure (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)")

        user_id = entry.user_id or payload.get("user_id")
        if user_id is None:
            raise NotificationSkipped("Destinataire push absent")

        subscriptions = self.push_subscription_dao.get_active_subscriptions(session, int(user_id))
        if not subscriptions:
            raise NotificationSkipped("Aucun abonnement push actif")

        message = {
            "title": payload.get("title") or "SOUKI",
            "body": payload.get("body") or "",
            "url": payload.get("url") or "/",
            "event": payload.get("event"),
            "data": payload.get("data") or {},
        }

        delivered = 0
        transient_error: Exception | None = None
        for subscription in subscriptions:
            try:
                web_push_service.send(
                    endpoint=str(subscription.endpoint),
                    p256dh=str(subscription.p256dh),
                    auth=str(subscription.auth),
                    payload=message,
                )
                delivered += 1
            except PushSubscriptionGone:
                self.push_subscription_dao.revoke_by_endpoint(session, endpoint=str(subscription.endpoint))
            except WebPushError as exc:
                transient_error = exc

        if delivered:
            # Au moins un appareil a recu le message : reessayer ne ferait que
            # produire des doublons sur ceux qui ont deja recu.
            return
        if transient_error is not None:
            raise RuntimeError(str(transient_error))
        raise NotificationSkipped("Tous les abonnements push etaient expires")


def run_outbox_cycle() -> None:
    """Point d'entree du job periodique (voir scheduler_service)."""
    counters = DeliveryOutboxWorker().run_once()
    if any(counters.values()):
        logger.info(
            "[OUTBOX] envoyes=%s reprogrammes=%s abandonnes=%s ignores=%s",
            counters["sent"],
            counters["retried"],
            counters["failed"],
            counters["skipped"],
        )


if __name__ == "__main__":
    DeliveryOutboxWorker().run_forever()
