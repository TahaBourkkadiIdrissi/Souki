from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from config import Base


class Permission(Base):
    __tablename__ = "permissions"
    __table_args__ = (
        UniqueConstraint("resource", "action", name="uq_permissions_resource_action"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    resource = Column(String(60), nullable=False, index=True)
    action = Column(String(60), nullable=False)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    role_permissions = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan")

