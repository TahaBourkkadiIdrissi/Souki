"""Fan-out des notifications : evenement metier -> canaux autorises -> outbox.

Point d'entree unique cote metier. La regle d'or : `notify()` ne leve jamais.
Une notification est un effet de bord ; elle ne doit jamais faire echouer la
commande, la livraison ou le dispatch qui la declenche.

Les ecritures se font dans la session appelante : la notification est donc
committee avec le changement metier (pattern outbox), ou perdue avec lui.
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from dao.push_subscription_dao import PushSubscriptionDaoBD
from entities.notification_outbox_entity import NotificationOutbox
from entities.user_entity import User
from entities.user_notification_preferences_entity import UserNotificationPreferences
from services.notification_catalog import (
    CATEGORY_TO_COLUMN,
    CHANNEL_EMAIL,
    CHANNEL_PUSH,
    DEFAULT_PREFERENCES,
    NotificationContent,
    NotificationEvent,
    event_for_status,
    get_event,
)

logger = logging.getLogger("souki.notifications")

MOROCCO_TIMEZONE = ZoneInfo("Africa/Casablanca")

# Heures de silence (heure marocaine) : aucun push marketing n'est livre entre
# QUIET_START et QUIET_END, il est simplement reprogramme.
QUIET_HOURS_START = int(os.getenv("SOUKI_NOTIFICATION_QUIET_START", "21"))
QUIET_HOURS_END = int(os.getenv("SOUKI_NOTIFICATION_QUIET_END", "8"))


def _is_quiet_hour(local_time: datetime) -> bool:
    hour = local_time.hour
    if QUIET_HOURS_START == QUIET_HOURS_END:
        return False
    if QUIET_HOURS_START > QUIET_HOURS_END:
        # Plage a cheval sur minuit (cas normal : 21h -> 8h).
        return hour >= QUIET_HOURS_START or hour < QUIET_HOURS_END
    return QUIET_HOURS_START <= hour < QUIET_HOURS_END


def _defer_past_quiet_hours(now: datetime) -> datetime:
    """Repousse l'envoi au prochain creneau autorise, ou le laisse tel quel."""
    local_now = now.astimezone(MOROCCO_TIMEZONE)
    if not _is_quiet_hour(local_now):
        return now

    resume = local_now.replace(hour=QUIET_HOURS_END, minute=0, second=0, microsecond=0)
    if resume <= local_now:
        resume += timedelta(days=1)
    return resume.astimezone(timezone.utc)


class NotificationService:

    def __init__(self, push_subscription_dao: PushSubscriptionDaoBD | None = None) -> None:
        self.push_subscription_dao = push_subscription_dao or PushSubscriptionDaoBD()

    # --- API publique -------------------------------------------------------

    def notify(
        self,
        session: Session,
        *,
        user_id: int | None,
        event_key: str,
        data: dict[str, Any] | None = None,
        dedupe_suffix: str | None = None,
    ) -> list[str]:
        """Met en file la notification sur tous les canaux autorises.

        `dedupe_suffix` doit identifier l'occurrence metier (ex. la version de
        statut de la commande) : deux appels avec le meme suffixe ne produisent
        qu'un seul envoi par canal.

        Retourne la liste des canaux effectivement mis en file.
        """
        try:
            return self._notify(
                session,
                user_id=user_id,
                event_key=event_key,
                data=data or {},
                dedupe_suffix=dedupe_suffix,
            )
        except Exception as exc:
            # Un echec de notification ne doit jamais remonter dans le flux metier.
            logger.error(
                "[NOTIF] Fan-out impossible (event=%s, user_id=%s) : %s",
                event_key,
                user_id,
                type(exc).__name__,
            )
            return []

    def notify_order_status(
        self,
        session: Session,
        *,
        client_id: int | None,
        commande_id: int,
        new_status: str,
        data: dict[str, Any] | None = None,
        dedupe_suffix: str | None = None,
    ) -> list[str]:
        """Notifie le client du passage de sa commande a `new_status`.

        Les statuts purement internes (EN_ATTENTE, A_LIVRER...) sont ignores :
        le catalogue ne leur associe aucun evenement.
        """
        event_key = event_for_status(new_status)
        if event_key is None or client_id is None:
            return []

        payload = {"commande_id": int(commande_id), "statut": new_status, **(data or {})}
        return self.notify(
            session,
            user_id=int(client_id),
            event_key=event_key,
            data=payload,
            dedupe_suffix=dedupe_suffix or f"{commande_id}:{new_status}",
        )

    # --- Implementation -----------------------------------------------------

    def _notify(
        self,
        session: Session,
        *,
        user_id: int | None,
        event_key: str,
        data: dict[str, Any],
        dedupe_suffix: str | None,
    ) -> list[str]:
        if user_id is None:
            return []

        event = get_event(event_key)
        if event is None:
            logger.error("[NOTIF] Evenement inconnu : %s", event_key)
            return []

        user = session.get(User, int(user_id))
        if user is None or user.is_active is False:
            return []

        preferences = self._resolve_preferences(session, int(user_id))
        if not self._is_category_enabled(event, preferences):
            return []

        content = event.render(data)
        now = datetime.now(timezone.utc)
        queued: list[str] = []

        for channel in event.channels:
            recipient = self._resolve_recipient(session, channel, event, user, preferences)
            if recipient is None:
                continue

            entry = self._build_entry(
                event=event,
                channel=channel,
                content=content,
                data=data,
                user_id=int(user_id),
                recipient=recipient,
                dedupe_suffix=dedupe_suffix,
                now=now,
            )
            if self._persist(session, entry):
                queued.append(channel)

        return queued

    def _resolve_preferences(self, session: Session, user_id: int) -> dict[str, bool]:
        """Lit les preferences sans jamais en creer : `notify` doit rester en
        lecture seule sur cette table (les chemins d'ecriture sont les reglages).
        """
        row = (
            session.query(UserNotificationPreferences)
            .filter(UserNotificationPreferences.user_id == user_id)
            .first()
        )
        if row is None:
            return dict(DEFAULT_PREFERENCES)

        resolved = dict(DEFAULT_PREFERENCES)
        resolved["email"] = self._flag(row.email, resolved["email"])
        resolved["push"] = self._flag(row.push, resolved["push"])
        for category, column in CATEGORY_TO_COLUMN.items():
            resolved[category] = self._flag(getattr(row, column, None), resolved[category])
        return resolved

    @staticmethod
    def _flag(value: Any, default: bool) -> bool:
        return default if value is None else bool(value)

    @staticmethod
    def _is_category_enabled(event: NotificationEvent, preferences: dict[str, bool]) -> bool:
        if event.category is None:
            return True
        return bool(preferences.get(event.category, True))

    def _resolve_recipient(
        self,
        session: Session,
        channel: str,
        event: NotificationEvent,
        user: User,
        preferences: dict[str, bool],
    ) -> str | None:
        """Retourne l'adresse a utiliser, ou None si le canal est ecarte.

        Pour le push, la valeur retournee est symbolique ("push") : le worker
        redistribue sur tous les abonnements actifs au moment de l'envoi.
        """
        if channel == CHANNEL_EMAIL:
            if not preferences["email"]:
                return None
            return str(user.email) if user.email else None

        if channel == CHANNEL_PUSH:
            if not preferences["push"]:
                return None
            # Inutile d'empiler des envois pour un compte sans appareil abonne.
            if self.push_subscription_dao.count_active_subscriptions(session, int(user.id)) == 0:
                return None
            return "push"

        return None

    def _build_entry(
        self,
        *,
        event: NotificationEvent,
        channel: str,
        content: NotificationContent,
        data: dict[str, Any],
        user_id: int,
        recipient: str,
        dedupe_suffix: str | None,
        now: datetime,
    ) -> NotificationOutbox:
        payload: dict[str, Any] = {
            "event": event.key,
            "channel": channel,
            "user_id": user_id,
            "title": content.title,
            "body": content.body,
            "url": content.url,
            "data": data,
            "server_timestamp": now.isoformat(),
        }
        if channel == CHANNEL_EMAIL:
            payload["recipient"] = recipient
            payload["subject"] = content.for_email_subject()
            payload["cta_label"] = content.email_cta_label

        dedupe_key = (
            f"{event.key}:{user_id}:{channel}:{dedupe_suffix}"[:180] if dedupe_suffix else None
        )

        return NotificationOutbox(
            type=channel,
            payload=payload,
            status="PENDING",
            user_id=user_id,
            event=event.key,
            dedupe_key=dedupe_key,
            attempts=0,
            next_attempt_at=self._first_attempt_at(event, channel, now),
        )

    @staticmethod
    def _first_attempt_at(event: NotificationEvent, channel: str, now: datetime) -> datetime:
        # Le push marketing peut attendre le matin ; le transactionnel (et
        # l'email, jamais intrusif) part immediatement.
        respects_quiet_hours = channel == CHANNEL_PUSH and event.marketing
        if not respects_quiet_hours:
            return now
        return _defer_past_quiet_hours(now)

    @staticmethod
    def _persist(session: Session, entry: NotificationOutbox) -> bool:
        """Insere l'entree ; retourne False si la cle d'idempotence existe deja."""
        try:
            # SAVEPOINT : un conflit d'unicite ne doit pas invalider la transaction
            # metier en cours (la commande reste valide si son avis est deja parti).
            with session.begin_nested():
                session.add(entry)
                session.flush()
            return True
        except IntegrityError:
            logger.info("[NOTIF] Doublon ignore (event=%s, canal=%s)", entry.event, entry.type)
            return False


notification_service = NotificationService()
