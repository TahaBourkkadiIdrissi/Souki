from datetime import date, datetime
from zoneinfo import ZoneInfo


MOROCCO_TIMEZONE = ZoneInfo("Africa/Casablanca")


def today_morocco() -> date:
    return datetime.now(MOROCCO_TIMEZONE).date()
