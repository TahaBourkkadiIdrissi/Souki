from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from config import Base


class VerificationCode(Base):
    __tablename__ = "t_verification_codes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("t_users.id"), nullable=False, index=True)
    channel = Column(String(20), nullable=False)
    code_hash = Column(String(128), nullable=False)
    attempt_count = Column(Integer, default=0)
    resend_count = Column(Integer, default=1)
    expires_at = Column(DateTime, nullable=False)
    window_started_at = Column(DateTime, nullable=False, server_default=func.now())
    last_sent_at = Column(DateTime, nullable=False, server_default=func.now())
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User")
