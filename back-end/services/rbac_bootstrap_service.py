import hashlib
import json
from pathlib import Path
from typing import Dict

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import SQLAlchemyError

from config import LocalSession
from entities.permission_entity import Permission
from entities.role_entity import Role
from entities.user_entity import User
from entities.user_role_entity import UserRole
from entities.role_permission_entity import RolePermission
from rbac_config import PERMISSION_DEFINITIONS, ROLE_DEFINITIONS, ROLE_PERMISSION_MAP

_HASH_FILE = Path(__file__).resolve().parent.parent / ".rbac_bootstrap_hash"


def _compute_rbac_hash() -> str:
    payload = json.dumps(
        {
            "roles": ROLE_DEFINITIONS,
            "permissions": PERMISSION_DEFINITIONS,
            "role_permissions": ROLE_PERMISSION_MAP,
        },
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


class RBACBootstrapService:
    def sync_rbac(self) -> None:
        current_hash = _compute_rbac_hash()
        stored_hash = _HASH_FILE.read_text().strip() if _HASH_FILE.exists() else ""
        config_changed = current_hash != stored_hash

        db = LocalSession()
        try:
            if config_changed:
                print("[RBAC] Configuration modifiée — synchronisation complète...")
                role_map = self._ensure_roles(db)
                permission_map = self._ensure_permissions(db)
                self._ensure_role_permissions(db, role_map, permission_map)
            else:
                print("[RBAC] Configuration inchangée — synchronisation des utilisateurs uniquement.")

            self._sync_existing_users(db)
            self._audit_admins(db)
            db.commit()

            if config_changed:
                _HASH_FILE.write_text(current_hash)
                print("[RBAC] Bootstrap terminé et hash sauvegardé.")
        except SQLAlchemyError as exc:
            db.rollback()
            print(f"[RBAC] Bootstrap échoué: {exc}")
        finally:
            db.close()

    def _ensure_roles(self, db) -> Dict[str, Role]:
        stmt = pg_insert(Role).values(
            [
                {
                    "code": r["code"],
                    "label": r["label"],
                    "description": r["description"],
                    "is_system": True,
                    "is_active": True,
                }
                for r in ROLE_DEFINITIONS
            ]
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["code"],
            set_={
                "label": stmt.excluded.label,
                "description": stmt.excluded.description,
                "is_active": True,
            },
        )
        db.execute(stmt)
        db.flush()
        codes = [r["code"] for r in ROLE_DEFINITIONS]
        roles = db.query(Role).filter(Role.code.in_(codes)).all()
        return {r.code: r for r in roles}

    def _ensure_permissions(self, db) -> Dict[str, Permission]:
        stmt = pg_insert(Permission).values(
            [
                {
                    "code": p["code"],
                    "resource": p["resource"],
                    "action": p["action"],
                    "description": p["description"],
                    "is_system": True,
                }
                for p in PERMISSION_DEFINITIONS
            ]
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["code"],
            set_={
                "resource": stmt.excluded.resource,
                "action": stmt.excluded.action,
                "description": stmt.excluded.description,
            },
        )
        db.execute(stmt)
        db.flush()
        codes = [p["code"] for p in PERMISSION_DEFINITIONS]
        perms = db.query(Permission).filter(Permission.code.in_(codes)).all()
        return {p.code: p for p in perms}

    def _ensure_role_permissions(
        self, db, role_map: Dict[str, Role], permission_map: Dict[str, Permission]
    ) -> None:
        pairs = []
        for role_code, perm_code in ROLE_PERMISSION_MAP:
            if role_code in role_map and perm_code in permission_map:
                pairs.append(
                    {
                        "role_id": int(role_map[role_code].id),  # type: ignore[arg-type]
                        "permission_id": int(permission_map[perm_code].id),  # type: ignore[arg-type]
                    }
                )
        if "ADMIN_SUPER" in role_map:
            admin_super_id = int(role_map["ADMIN_SUPER"].id)  # type: ignore[arg-type]
            for perm in permission_map.values():
                pairs.append(
                    {
                        "role_id": admin_super_id,
                        "permission_id": int(perm.id),  # type: ignore[arg-type]
                    }
                )
        if pairs:
            stmt = pg_insert(RolePermission).values(pairs).on_conflict_do_nothing()
            db.execute(stmt)
            db.flush()

    def _sync_existing_users(self, db) -> None:
        users = db.query(User.id, User.role).all()
        if not users:
            return

        role_ids = {r.code: int(r.id) for r in db.query(Role).all()}  # type: ignore[arg-type]
        existing_pairs = {
            (int(ur.user_id), int(ur.role_id))
            for ur in db.query(UserRole.user_id, UserRole.role_id).all()
        }

        _valid_codes = {"CLIENT", "PARENT", "LIVREUR", "FOURNISSEUR", "ADMIN"}
        new_rows = []
        for user_id, legacy_role in users:
            code = (legacy_role or "CLIENT").upper()
            target = code if code in _valid_codes else "CLIENT"
            role_id = role_ids.get(target)
            if role_id and (int(user_id), role_id) not in existing_pairs:
                new_rows.append({"user_id": int(user_id), "role_id": role_id, "is_active": True})

        if new_rows:
            stmt = pg_insert(UserRole).values(new_rows)
            stmt = stmt.on_conflict_do_update(
                index_elements=["user_id", "role_id"], set_={"is_active": True}
            )
            db.execute(stmt)
            db.flush()

    def _audit_admins(self, db) -> None:
        admin_users = (
            db.query(User.id, User.email)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .filter(Role.code.in_(["ADMIN", "ADMIN_SUPER"]), UserRole.is_active.is_(True))
            .all()
        )
        print(
            f"[RBAC] Audit admin — {len(admin_users)} admin(s): "
            f"{[(u.id, u.email) for u in admin_users]}"
        )
