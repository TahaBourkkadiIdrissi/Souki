from typing import Dict

from sqlalchemy.exc import SQLAlchemyError

from config import LocalSession
from dao.authorization_dao import AuthorizationDao
from entities.permission_entity import Permission
from entities.role_entity import Role
from entities.user_entity import User
from rbac_config import PERMISSION_DEFINITIONS, ROLE_DEFINITIONS, ROLE_PERMISSION_MAP


class RBACBootstrapService:
    def __init__(self) -> None:
        self.authorization_dao = AuthorizationDao()

    def sync_rbac(self) -> None:
        db = LocalSession()
        try:
            role_map = self._ensure_roles(db)
            permission_map = self._ensure_permissions(db)
            self._ensure_role_permissions(db, role_map, permission_map)
            self._sync_existing_users(db)
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            print(f"[RBAC] Bootstrap skipped due to database error: {exc}")
        finally:
            db.close()

    def _ensure_roles(self, db) -> Dict[str, Role]:
        role_map: Dict[str, Role] = {}
        for item in ROLE_DEFINITIONS:
            role = self.authorization_dao.find_role_by_code(db, item["code"])
            if not role:
                role = Role(
                    code=item["code"],
                    label=item["label"],
                    description=item["description"],
                    is_system=True,
                    is_active=True,
                )
                db.add(role)
                db.flush()
            else:
                role.label = item["label"]
                role.description = item["description"]
                role.is_active = True
            role_map[item["code"]] = role
        return role_map

    def _ensure_permissions(self, db) -> Dict[str, Permission]:
        permission_map: Dict[str, Permission] = {}
        for item in PERMISSION_DEFINITIONS:
            permission = self.authorization_dao.find_permission_by_code(db, item["code"])
            if not permission:
                permission = Permission(
                    code=item["code"],
                    resource=item["resource"],
                    action=item["action"],
                    description=item["description"],
                    is_system=True,
                )
                db.add(permission)
                db.flush()
            else:
                permission.resource = item["resource"]
                permission.action = item["action"]
                permission.description = item["description"]
            permission_map[item["code"]] = permission
        return permission_map

    def _ensure_role_permissions(self, db, role_map: Dict[str, Role], permission_map: Dict[str, Permission]) -> None:
        for role_code, permission_code in ROLE_PERMISSION_MAP:
            if role_code not in role_map or permission_code not in permission_map:
                continue
            self.authorization_dao.ensure_role_permission(db, role_code, permission_code)

        for permission_code in permission_map:
            self.authorization_dao.ensure_role_permission(db, "ADMIN_SUPER", permission_code)

    def _sync_existing_users(self, db) -> None:
        users = db.query(User).all()
        for user in users:
            role_code = (user.role or "CLIENT").upper()
            if role_code == "ADMIN":
                target_role = "ADMIN"
            elif role_code in {"CLIENT", "PARENT", "LIVREUR", "FOURNISSEUR"}:
                target_role = role_code
            else:
                target_role = "CLIENT"

            self.authorization_dao.assign_role_to_user(
                db,
                user_id=int(user.id),  # type: ignore[arg-type]
                role_code=target_role,
            )

