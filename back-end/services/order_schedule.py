"""Commercial hours and delivery batches, always in Moroccan local time."""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

MOROCCO_TIMEZONE = ZoneInfo("Africa/Casablanca")
ORDER_CLOSE_HOUR = 1
ORDER_OPEN_HOUR = 8
ORDER_CLOSED_MESSAGE = (
    "Les commandes et leurs modifications sont fermées de 01h00 à 08h00 "
    "(heure du Maroc). Réouverture à 08h00."
)
# Shared/exclusive PostgreSQL transaction lock: checkout finishes before JIT reads.
ORDER_BATCH_LOCK_ID = 20261009


def local_now(now: datetime | None = None) -> datetime:
    value = now or datetime.now(MOROCCO_TIMEZONE)
    if value.tzinfo is None:
        value = value.replace(tzinfo=MOROCCO_TIMEZONE)
    return value.astimezone(MOROCCO_TIMEZONE)


def orders_closed(now: datetime | None = None) -> bool:
    return ORDER_CLOSE_HOUR <= local_now(now).hour < ORDER_OPEN_HOUR


def delivery_date_for_order(now: datetime | None = None) -> date:
    value = local_now(now)
    return value.date() + timedelta(days=1 if value.hour >= ORDER_OPEN_HOUR else 0)


def delivery_cutoff(delivery_date: date) -> datetime:
    return datetime.combine(delivery_date, time(ORDER_CLOSE_HOUR), MOROCCO_TIMEZONE)


def schedule_snapshot(now: datetime | None = None) -> dict:
    value = local_now(now)
    closed = orders_closed(value)
    next_transition = (
        datetime.combine(value.date(), time(ORDER_OPEN_HOUR), MOROCCO_TIMEZONE)
        if closed else delivery_cutoff(delivery_date_for_order(value))
    )
    return {
        "closed": closed, "server_time": value.astimezone(timezone.utc).isoformat(),
        "next_transition": next_transition.astimezone(timezone.utc).isoformat(),
        "delivery_date": None if closed else delivery_date_for_order(value).isoformat(),
        "timezone": "Africa/Casablanca", "open_hour": ORDER_OPEN_HOUR,
        "close_hour": ORDER_CLOSE_HOUR, "message": ORDER_CLOSED_MESSAGE if closed else "",
    }
