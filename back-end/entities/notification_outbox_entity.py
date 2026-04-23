from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB

from config import Base


class NotificationOutbox(Base):
    __tablename__ = "t_notification_outbox"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String(20), nullable=False, index=True)
    payload = Column(JSONB, nullable=False)
    status = Column(String(20), nullable=False, default="PENDING", server_default="PENDING", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
