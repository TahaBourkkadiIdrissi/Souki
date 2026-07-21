from dataclasses import dataclass, field
from typing import Iterable, List, Optional, Set

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from dao.authorization_dao import AuthorizationDao
from dao.user_dao import UserDao
from entities.user_entity import User
from rbac_config import (
    DEFAULT_DASHBOARD_RULES,
    LEGACY_ROLE_PERMISSION_FALLBACK,
    ROLE_PRIORITY,
)


@dataclass
class AuthorizationPrincipal:
    user_id: int
    email: Optional[str]
    phone: Optional[str]
    is_verified: bool
    is_active: bool
    legacy_role: Optional[str]
    primary_role: str
    roles: Set[str] = field(default_factory=set)
    permissions: Set[str] = field(default_factory=set)
    default_dashboard: str = "/"
    # False = compte jamais onboarde, le front doit afficher l'onboarding.
    onboarding_completed: bool = False

    def has_role(self, role: str) -> bool:
        return role.upper() in self.roles

    def has_any_role(self, roles: Iterable[str]) -> bool:
        normalized = {role.upper() for role in roles}
        return bool(self.roles.intersection(normalized))

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions

    def has_all_permissions(self, permissions: Iterable[str]) -> bool:
        required = set(permissions)
        return required.issubset(self.permissions)

    def has_any_permission(self, permissions: Iterable[str]) -> bool:
        required = set(permissions)
        return bool(required.intersection(self.permissions))


class AuthorizationService:
    def __init__(
        self,
        db: Session,
        authorization_dao: Optional[AuthorizationDao] = None,
        user_dao: Optional[UserDao] = None,
    ) -> None:
        self.db = db
        self.authorization_dao = authorization_dao or AuthorizationDao()
        self.user_dao = user_dao or UserDao()

    def build_principal(self, user_id: int) -> AuthorizationPrincipal:
        user = self.user_dao.read(self.db, user_id)
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur introuvable")
        return self.build_principal_from_user(user)

    def build_principal_from_user(self, user: User) -> AuthorizationPrincipal:
        is_active = bool(getattr(user, "is_active", True))
        if not is_active:
            raise HTTPException(status_code=403, detail="Compte desactive")
        if not user.is_verified:
            raise HTTPException(status_code=403, detail="Compte non verifie")

        roles, permissions = self._load_roles_and_permissions(user)
        primary_role = self.resolve_primary_role(roles, user.role)
        default_dashboard = self.resolve_default_dashboard(permissions)

        return AuthorizationPrincipal(
            user_id=int(user.id),  # type: ignore[arg-type]
            email=user.email,
            phone=user.phone,
            is_verified=bool(user.is_verified),
            is_active=is_active,
            legacy_role=user.role,
            primary_role=primary_role,
            roles=roles,
            permissions=permissions,
            default_dashboard=default_dashboard,
            onboarding_completed=getattr(user, "onboarding_completed_at", None) is not None,
        )

    def resolve_primary_role(self, roles: Iterable[str], legacy_role: Optional[str]) -> str:
        normalized_roles = {role.upper() for role in roles if role}
        if legacy_role and legacy_role.upper() in normalized_roles:
            return legacy_role.upper()

        for role in ROLE_PRIORITY:
            if role in normalized_roles:
                return role

        return legacy_role.upper() if legacy_role else "CLIENT"

    def resolve_default_dashboard(self, permissions: Iterable[str]) -> str:
        permission_set = set(permissions)
        for permission_code, dashboard_path in DEFAULT_DASHBOARD_RULES:
            if permission_code in permission_set:
                return dashboard_path
        return "/"

    def export_principal(self, principal: AuthorizationPrincipal) -> dict:
        return {
            "id": principal.user_id,
            "email": principal.email,
            "phone": principal.phone,
            "role": principal.primary_role,
            "legacy_role": principal.legacy_role,
            "roles": sorted(principal.roles),
            "permissions": sorted(principal.permissions),
            "is_verified": principal.is_verified,
            "is_active": principal.is_active,
            "default_dashboard": principal.default_dashboard,
        }

    def ensure_user_role(self, user_id: int, role_code: str, assigned_by_user_id: Optional[int] = None) -> None:
        normalized_role = (role_code or "").upper()
        if not normalized_role:
            return
        try:
            self.authorization_dao.assign_role_to_user(
                self.db,
                user_id=user_id,
                role_code=normalized_role,
                assigned_by_user_id=assigned_by_user_id,
            )
        except SQLAlchemyError:
            self.db.rollback()

    def _load_roles_and_permissions(self, user: User) -> tuple[Set[str], Set[str]]:
        try:
            roles, permissions = self.authorization_dao.get_roles_and_permissions(
                self.db, int(user.id)  # type: ignore[arg-type]
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(status_code=503, detail="Service temporairement indisponible")

        if not roles:
            # Utilisateur non encore migré vers RBAC — fallback legacy acceptable
            legacy_role = (user.role or "").upper()
            if legacy_role:
                roles.add(legacy_role)
                permissions.update(LEGACY_ROLE_PERMISSION_FALLBACK.get(legacy_role, set()))

        return roles, permissions

