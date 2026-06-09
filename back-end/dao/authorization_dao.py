from datetime import datetime
from typing import Optional, Set

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from entities.permission_entity import Permission
from entities.role_entity import Role
from entities.role_permission_entity import RolePermission
from entities.user_role_entity import UserRole


class AuthorizationDao:
    def get_active_role_codes(self, db: Session, user_id: int) -> Set[str]:
        rows = (
            db.query(Role.code)
            .join(UserRole, UserRole.role_id == Role.id)
            .filter(UserRole.user_id == user_id)
            .filter(UserRole.is_active.is_(True))
            .filter(or_(UserRole.expires_at.is_(None), UserRole.expires_at > func.now()))
            .filter(Role.is_active.is_(True))
            .all()
        )
        return {str(row[0]).upper() for row in rows}

    def get_effective_permission_codes(self, db: Session, user_id: int) -> Set[str]:
        rows = (
            db.query(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .join(UserRole, UserRole.role_id == Role.id)
            .filter(UserRole.user_id == user_id)
            .filter(UserRole.is_active.is_(True))
            .filter(or_(UserRole.expires_at.is_(None), UserRole.expires_at > func.now()))
            .filter(Role.is_active.is_(True))
            .all()
        )
        return {str(row[0]) for row in rows}

    def find_role_by_code(self, db: Session, role_code: str) -> Optional[Role]:
        return (
            db.query(Role)
            .filter(Role.code == role_code.upper())
            .first()
        )

    def find_permission_by_code(self, db: Session, permission_code: str) -> Optional[Permission]:
        return (
            db.query(Permission)
            .filter(Permission.code == permission_code)
            .first()
        )

    def find_user_role(self, db: Session, user_id: int, role_id: int) -> Optional[UserRole]:
        return (
            db.query(UserRole)
            .filter(UserRole.user_id == user_id, UserRole.role_id == role_id)
            .first()
        )

    def assign_role_to_user(
        self,
        db: Session,
        user_id: int,
        role_code: str,
        assigned_by_user_id: Optional[int] = None,
        expires_at: Optional[datetime] = None,
    ) -> Optional[UserRole]:
        role = self.find_role_by_code(db, role_code)
        if not role:
            return None

        existing = self.find_user_role(db, user_id, int(role.id))  # type: ignore[arg-type]
        if existing:
            existing.is_active = True
            existing.assigned_by_user_id = assigned_by_user_id
            existing.expires_at = expires_at
            return existing

        user_role = UserRole(
            user_id=user_id,
            role_id=int(role.id),  # type: ignore[arg-type]
            is_active=True,
            assigned_by_user_id=assigned_by_user_id,
            expires_at=expires_at,
        )
        db.add(user_role)
        db.flush()
        return user_role

    def deactivate_role_for_user(self, db: Session, user_id: int, role_code: str) -> bool:
        role = self.find_role_by_code(db, role_code)
        if not role:
            return False

        existing = self.find_user_role(db, user_id, int(role.id))  # type: ignore[arg-type]
        if not existing:
            return False

        existing.is_active = False
        db.flush()
        return True

    def ensure_role_permission(self, db: Session, role_code: str, permission_code: str) -> None:
        role = self.find_role_by_code(db, role_code)
        permission = self.find_permission_by_code(db, permission_code)
        if not role or not permission:
            return

        existing = (
            db.query(RolePermission)
            .filter(
                RolePermission.role_id == int(role.id),  # type: ignore[arg-type]
                RolePermission.permission_id == int(permission.id),  # type: ignore[arg-type]
            )
            .first()
        )
        if existing:
            return

        db.add(
            RolePermission(
                role_id=int(role.id),  # type: ignore[arg-type]
                permission_id=int(permission.id),  # type: ignore[arg-type]
            )
        )
        db.flush()

