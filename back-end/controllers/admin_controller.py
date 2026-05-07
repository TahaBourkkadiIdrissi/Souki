import asyncio
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from auth_dependencies import require_permission
from config import ALGORITHM, LocalSession, SECRET_KEY
from dao.livreur_dao import LivreurDaoBD
from dependencies import get_blacklist_service, get_client_admin_service, get_dashboard_service
from dto.client_admin_dto import AdminClientsPageDTO
from dto.client_blacklist_dto import BlacklistReportDTO, ClientBlacklistDTO, LiftBlacklistDTO
from dto.dashboard_dto import DashboardDTO
from interfaces.client_admin_service_interface import IClientAdminService
from interfaces.client_blacklist_service_interface import IClientBlacklistService
from interfaces.dashboard_service_interface import IDashboardService
from services.authorization_service import AuthorizationService

admin_router = APIRouter(prefix="/admin", tags=["Admin"])
api_admin_router = APIRouter(prefix="/api/admin", tags=["Admin"])


def _parse_since_cursor(raw_value: str | None) -> datetime | None:
    if not raw_value:
        return None

    try:
        return datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Parametre since invalide.") from exc


def _serialize_delivery_change(change: dict) -> dict:
    serialized = dict(change)
    for key in ("server_timestamp", "device_timestamp"):
        value = serialized.get(key)
        if isinstance(value, datetime):
            serialized[key] = value.isoformat()
    return serialized


def _authorize_delivery_stream(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Session expiree ou token invalide") from exc

    db = LocalSession()
    try:
        principal = AuthorizationService(db).build_principal(user_id)
    finally:
        db.close()

    if not principal.has_all_permissions({"admin.panel.access", "deliveries.read"}):
        raise HTTPException(status_code=403, detail="Permission insuffisante")

    return principal


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


@admin_router.get("/dashboard", response_model=DashboardDTO)
def get_admin_dashboard_context(
    periode: str = Query(default="today"),
    principal=Depends(require_permission("admin.panel.access")),
    service: IDashboardService = Depends(get_dashboard_service),
):
    _ = principal
    session = LocalSession()
    try:
        return service.get_dashboard(session, periode)
    finally:
        session.close()


@admin_router.get("/deliveries/changes")
def get_delivery_changes(
    since: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    principal=Depends(require_permission("admin.panel.access", "deliveries.read")),
):
    parsed_since = _parse_since_cursor(since)

    db = LocalSession()
    try:
        changes = LivreurDaoBD().get_delivery_changes_since(db, since=parsed_since, limit=limit)
        return {
            "status": "ok",
            "changes": [_serialize_delivery_change(change) for change in changes],
        }
    finally:
        db.close()


@admin_router.get("/blacklist", response_model=List[ClientBlacklistDTO])
def get_blacklisted_clients(
    principal=Depends(require_permission("admin.panel.access", "clients.blacklist")),
    service: IClientBlacklistService = Depends(get_blacklist_service),
):
    _ = principal
    session = LocalSession()
    try:
        return service.get_blacklisted_clients(session)
    finally:
        session.close()


@api_admin_router.get("/clients", response_model=AdminClientsPageDTO)
def get_admin_clients(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    blacklisted: bool | None = Query(default=None),
    principal=Depends(require_permission("admin.panel.access", "clients.read")),
    service: IClientAdminService = Depends(get_client_admin_service),
):
    _ = principal
    session = LocalSession()
    try:
        return service.get_clients_page(
            session,
            search=search,
            page=page,
            blacklisted=blacklisted,
        )
    finally:
        session.close()


@admin_router.get("/blacklist/report/monthly", response_model=BlacklistReportDTO)
def get_monthly_report(
    year: int,
    month: int,
    principal=Depends(require_permission("admin.panel.access", "clients.blacklist")),
    service: IClientBlacklistService = Depends(get_blacklist_service),
):
    _ = principal
    session = LocalSession()
    try:
        return service.get_monthly_report(session, year, month)
    finally:
        session.close()


@admin_router.patch("/blacklist/{client_id}")
def blacklist_client_manual(
    client_id: int,
    payload: LiftBlacklistDTO,
    principal=Depends(require_permission("admin.panel.access", "clients.blacklist")),
    service: IClientBlacklistService = Depends(get_blacklist_service),
):
    session = LocalSession()
    try:
        service.blacklist_manual(session, client_id, principal.user_id, payload.reason or "")
        return {"message": "Client blackliste avec succes"}
    finally:
        session.close()


@admin_router.patch("/blacklist/{client_id}/lift")
def lift_blacklist(
    client_id: int,
    payload: LiftBlacklistDTO,
    principal=Depends(require_permission("admin.panel.access", "clients.blacklist")),
    service: IClientBlacklistService = Depends(get_blacklist_service),
):
    session = LocalSession()
    try:
        service.lift_blacklist(session, client_id, principal.user_id, payload.reason)
        return {"message": "Blacklist leve avec succes"}
    finally:
        session.close()


@admin_router.websocket("/ws/deliveries")
async def stream_delivery_changes(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401, reason="Token requis")
        return

    try:
        _authorize_delivery_stream(token)
        since = _parse_since_cursor(websocket.query_params.get("since"))
    except HTTPException as exc:
        close_code = 4403 if exc.status_code == 403 else 4401
        await websocket.close(code=close_code, reason=exc.detail)
        return

    await websocket.accept()
    last_sync = since

    try:
        while True:
            db = LocalSession()
            try:
                changes = LivreurDaoBD().get_delivery_changes_since(db, since=last_sync, limit=200)
            finally:
                db.close()

            for change in changes:
                serialized_change = _serialize_delivery_change(change)
                await websocket.send_json(
                    {
                        "type": "ALERT_ABSENT"
                        if serialized_change.get("new_status") == "ABSENT"
                        else "DELIVERY_STATUS_UPDATED",
                        "change": serialized_change,
                    }
                )

                server_timestamp = change.get("server_timestamp")
                if isinstance(server_timestamp, datetime):
                    last_sync = server_timestamp

            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return
