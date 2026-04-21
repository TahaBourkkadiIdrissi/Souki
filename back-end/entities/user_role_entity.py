from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, PrimaryKeyConstraint, func
from sqlalchemy.orm import relationship

from config import Base


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (
        PrimaryKeyConstraint("user_id", "role_id", name="pk_user_roles"),
    )

    user_id = Column(Integer, ForeignKey("t_users.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    assigned_at = Column(DateTime, server_default=func.now(), nullable=False)
    assigned_by_user_id = Column(Integer, ForeignKey("t_users.id", ondelete="SET NULL"), nullable=True)
    expires_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="user_roles")
    role = relationship("Role", back_populates="user_roles")

