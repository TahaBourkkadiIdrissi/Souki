from fastapi import APIRouter, Depends

from auth_dependencies import require_permission

admin_router = APIRouter(prefix="/admin", tags=["Admin"])


@admin_router.get("/session")
def get_admin_session(
    principal=Depends(require_permission("admin.panel.access"))
):
    return {
        "status": "ok",
        "user_id": principal.user_id,
        "role": principal.primary_role,
        "roles": sorted(principal.roles),
        "permissions": sorted(principal.permissions),
        "default_dashboard": principal.default_dashboard,
    }


@admin_router.get("/dashboard")
def get_admin_dashboard_context(
    principal=Depends(require_permission("admin.panel.access"))
):
    modules = {
        "orders": principal.has_permission("orders.read"),
        "dispatch": principal.has_permission("orders.assign_livreur"),
        "products": principal.has_permission("products.manage") or principal.has_permission("products.read"),
        "payments": principal.has_permission("payments.read"),
        "stats": principal.has_permission("stats.read"),
        "clients": principal.has_permission("clients.read"),
        "blacklist": principal.has_permission("clients.blacklist"),
    }
    return {
        "status": "ok",
        "modules": modules,
        "default_dashboard": principal.default_dashboard,
    }
