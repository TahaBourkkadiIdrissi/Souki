from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint

from config import Base


class ClientBlacklistNotificationRead(Base):
    __tablename__ = "t_client_blacklist_notification_reads"
    __table_args__ = (
        UniqueConstraint(
            "client_id",
            "blacklist_log_id",
            name="uq_client_blacklist_notification_read",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("t_clients.user_id"), nullable=False)
    blacklist_log_id = Column(Integer, ForeignKey("t_client_blacklist_logs.id"), nullable=False)
    seen_at = Column(DateTime, default=datetime.utcnow)
