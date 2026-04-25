from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from config import Base


class UserSession(Base):
    __tablename__ = "t_user_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("t_users.id"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    device_name = Column(String(120), nullable=True)
    browser = Column(String(120), nullable=True)
    location = Column(String(120), nullable=True)
    ip = Column(String(64), nullable=True)
    is_active = Column(Boolean, default=True)
    last_active = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="sessions")
