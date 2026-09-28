"""Regression checks for Morocco's September 2026 move to permanent GMT.

Run with PYTHONTZPATH='' (also set in the production Docker image).
No database or scheduler jobs are started.
"""
import unittest
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from apscheduler.triggers.cron import CronTrigger
MOROCCO_TIMEZONE = ZoneInfo("Africa/Casablanca")


class MoroccoTimezoneTests(unittest.TestCase):
    def test_2026_transition_and_history(self):
        for utc, hour, offset in [
            ((2026, 7, 22, 19, 0), 20, 1),
            ((2026, 9, 20, 0, 59), 1, 1),
            ((2026, 9, 20, 1, 0), 1, 0),
            ((2026, 9, 28, 20, 0), 20, 0),
            ((2027, 7, 22, 20, 0), 20, 0),
        ]:
            with self.subTest(utc=utc):
                local = datetime(*utc, tzinfo=timezone.utc).astimezone(MOROCCO_TIMEZONE)
                self.assertEqual(local.hour, hour)
                self.assertEqual(local.utcoffset(), timedelta(hours=offset))

    def test_daily_jobs_keep_their_local_hour(self):
        for month, day, offset in [(7, 22, 1), (9, 20, 0), (9, 28, 0)]:
            for hour, minute in [(18, 0), (20, 0), (21, 35)]:
                with self.subTest(date=(month, day), job=(hour, minute)):
                    now = datetime(2026, month, day, 12, tzinfo=timezone.utc)
                    trigger = CronTrigger(hour=hour, minute=minute, second=0, timezone=MOROCCO_TIMEZONE)
                    fire = trigger.get_next_fire_time(None, now)
                    self.assertEqual((fire.hour, fire.minute), (hour, minute))
                    self.assertEqual(fire.astimezone(timezone.utc),
                                     datetime(2026, month, day, hour - offset, minute, tzinfo=timezone.utc))

    def test_local_day_no_longer_advances_at_23_utc(self):
        now = datetime(2026, 9, 28, 23, 30, tzinfo=timezone.utc)
        self.assertEqual(now.astimezone(MOROCCO_TIMEZONE).date(), now.date())


if __name__ == '__main__':
    unittest.main()
