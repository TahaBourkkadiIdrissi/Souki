from fastapi import APIRouter, Depends

from auth_dependencies import require_auth
from config import LocalSession
from dependencies import get_blacklist_service
from dto.client_blacklist_dto import BlacklistStatusDTO, LiftRequestDTO
from interfaces.client_blacklist_service_interface import IClientBlacklistService


client_blacklist_router = APIRouter(
    prefix="/api/client/blacklist",
    tags=["Client-Blacklist"],
)


@client_blacklist_router.get("/status", response_model=BlacklistStatusDTO)
def get_client_blacklist_status(
    principal=Depends(require_auth),
    service: IClientBlacklistService = Depends(get_blacklist_service),
):
    session = LocalSession()
    try:
        return service.get_blacklist_status(session, principal.user_id)
    finally:
        session.close()


@client_blacklist_router.post("/lift-request")
def request_blacklist_lift(
    payload: LiftRequestDTO,
    principal=Depends(require_auth),
    service: IClientBlacklistService = Depends(get_blacklist_service),
):
    session = LocalSession()
    try:
        service.request_lift(session, principal.user_id, payload.motif)
        return {"message": "Demande envoyee"}
    finally:
        session.close()


@client_blacklist_router.patch("/lift-notification-seen")
def mark_lift_notification_seen(
    principal=Depends(require_auth),
    service: IClientBlacklistService = Depends(get_blacklist_service),
):
    session = LocalSession()
    try:
        service.mark_lift_notification_seen(session, principal.user_id)
        return {"ok": True}
    finally:
        session.close()
