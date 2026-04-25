from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import relationship

from config import Base


class UserNotificationPreferences(Base):
    __tablename__ = "t_user_notification_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("t_users.id"), unique=True, nullable=False, index=True)
    email = Column(Boolean, default=True)
    push = Column(Boolean, default=True)
    sms = Column(Boolean, default=False)
    promotions = Column(Boolean, default=True)
    order_updates = Column(Boolean, default=True)
    newsletter = Column(Boolean, default=False)
    livraison = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="notification_preferences")
