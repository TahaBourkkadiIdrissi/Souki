import json
import time

from sqlalchemy import select

from config import LocalSession
from entities.notification_outbox_entity import NotificationOutbox


class DeliveryOutboxWorker:

    def __init__(self, poll_interval_seconds: float = 1.0) -> None:
        self.poll_interval_seconds = poll_interval_seconds

    def run_forever(self) -> None:
        while True:
            self.run_once()
            time.sleep(self.poll_interval_seconds)

    def run_once(self) -> None:
        session = LocalSession()
        try:
            pending_entries = session.execute(
                select(NotificationOutbox)
                .where(NotificationOutbox.status == "PENDING")
                .order_by(NotificationOutbox.created_at.asc(), NotificationOutbox.id.asc())
                .limit(100)
            ).scalars().all()

            for entry in pending_entries:
                try:
                    self._dispatch(entry)
                    entry.status = "SENT"
                except Exception:
                    entry.status = "FAILED"

            session.commit()
        finally:
            session.close()

    def _dispatch(self, entry: NotificationOutbox) -> None:
        payload = entry.payload if isinstance(entry.payload, dict) else json.loads(entry.payload)
        print(f"[OUTBOX:{entry.type}] {json.dumps(payload, ensure_ascii=False)}")


if __name__ == "__main__":
    DeliveryOutboxWorker().run_forever()
