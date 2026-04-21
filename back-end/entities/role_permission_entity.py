from sqlalchemy import Column, DateTime, ForeignKey, Integer, PrimaryKeyConstraint, func
from sqlalchemy.orm import relationship

from config import Base


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (
        PrimaryKeyConstraint("role_id", "permission_id", name="pk_role_permissions"),
    )

    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)
    granted_at = Column(DateTime, server_default=func.now(), nullable=False)
    granted_by_user_id = Column(Integer, ForeignKey("t_users.id", ondelete="SET NULL"), nullable=True)

    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission", back_populates="role_permissions")
