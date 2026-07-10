import asyncio
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from auth_dependencies import require_permission
from config import LocalSession
from dao.livreur_dao import LivreurDaoBD
from dependencies import (
    get_blacklist_service,
    get_client_admin_service,
    get_dashboard_service,
    get_parrainage_service,
)
from dto.client_admin_dto import AdminClientsPageDTO
from dto.parrainage_admin_dto import ParrainageAdminOverviewDTO
from interfaces.parrainage_service_interface import IParrainageService
from dto.client_blacklist_dto import (
    BlacklistReportDTO,
    ClientBlacklistDTO,
    LiftBlacklistDTO,
    LiftRejectDTO,
    PendingLiftRequestDTO,
)
from dto.dashboard_dto import DashboardDTO
from interfaces.client_admin_service_interface import IClientAdminService
from interfaces.client_blacklist_service_interface import IClientBlacklistService
from interfaces.dashboard_service_interface import IDashboardService
from entities.user_entity import User
from services.authorization_service import AuthorizationService
from services.user_session_service import UserSessionService
from services.ws_ticket_service import WS_TICKET_TTL_SECONDS, ws_ticket_service

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


def _authorize_delivery_stream(ticket: str):
    """Autorise l'ouverture du flux via un ticket opaque a usage unique (VULN-007).

    Le ticket est emis par POST /admin/ws-ticket (route HTTP protegee). A la
    connexion, on reverifie que la session emettrice est toujours active, que le
    compte est actif et que les permissions sont toujours presentes : un ticket
    emis avant une deconnexion/revocation est refuse.
    """
    claims = ws_ticket_service.consume_ticket(ticket)
    if claims is None:
        raise HTTPException(status_code=401, detail="Ticket invalide ou expire")

    if claims.session_id is not None and not UserSessionService().is_session_active(claims.session_id):
        raise HTTPException(status_code=401, detail="Session expiree ou invalidee")

    db = LocalSession()
    try:
        user = db.query(User).filter(User.id == claims.user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Compte indisponible")
        principal = AuthorizationService(db).build_principal(claims.user_id)
    finally:
        db.close()

    if not principal.has_all_permissions({"admin.panel.access", "deliveries.read"}):
        raise HTTPException(status_code=403, detail="Permission insuffisante")

    return principal


@admin_router.post("/ws-ticket")
def create_delivery_stream_ticket(
    principal=Depends(require_permission("admin.panel.access", "deliveries.read")),
):
    """Emet un ticket WebSocket opaque (30 s, usage unique).

    require_permission passe par require_auth : session active et compte actif
    sont donc verifies AVANT l'emission. Le JWT principal ne transite jamais
    dans l'URL du WebSocket.
    """
    ticket = ws_ticket_service.issue_ticket(
        user_id=principal.user_id,
        session_id=getattr(principal, "session_id", None),
    )
    return {"ticket": ticket, "expires_in_seconds": WS_TICKET_TTL_SECONDS}


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
    date_custom: str | None = Query(default=None),
    principal=Depends(require_permission("admin.panel.access")),
    service: IDashboardService = Depends(get_dashboard_service),
):
    session = LocalSession()
    try:
        return service.get_dashboard(session, periode, date_custom)
    finally:
        session.close()


@admin_router.get("/parrainages", response_model=ParrainageAdminOverviewDTO)
def get_admin_parrainages(
    principal=Depends(require_permission("admin.panel.access")),
    service: IParrainageService = Depends(get_parrainage_service),
):
    session = LocalSession()
    try:
        return service.get_admin_overview(session)
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
    session = LocalSession()
    try:
        return service.get_monthly_report(session, year, month)
    finally:
        session.close()


@admin_router.get("/blacklist/lift-requests", response_model=List[PendingLiftRequestDTO])
def get_blacklist_lift_requests(
    principal=Depends(require_permission("admin.panel.access", "clients.blacklist")),
    service: IClientBlacklistService = Depends(get_blacklist_service),
):
    session = LocalSession()
    try:
        return service.get_pending_lift_requests(session)
    finally:
        session.close()


@admin_router.post("/blacklist/{client_id}/lift-reject")
def reject_blacklist_lift_request(
    client_id: int,
    payload: LiftRejectDTO,
    principal=Depends(require_permission("admin.panel.access", "clients.blacklist")),
    service: IClientBlacklistService = Depends(get_blacklist_service),
):
    session = LocalSession()
    try:
        service.reject_lift(session, client_id, principal.user_id, payload.motif)
        return {"message": "Demande de levee rejetee"}
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
    # Le JWT principal n'est plus accepte dans la query string : uniquement le
    # ticket opaque emis par POST /admin/ws-ticket (usage unique, 30 s).
    ticket = websocket.query_params.get("ticket")
    if not ticket:
        await websocket.close(code=4401, reason="Ticket requis")
        return

    try:
        _authorize_delivery_stream(ticket)
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
