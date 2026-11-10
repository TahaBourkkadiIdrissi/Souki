from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from auth_dependencies import oauth2_scheme
from config import LocalSession
from dao.auth_mobile_dao import AuthMobileDaoBD
from dto.auth_mobile_dto import CheckEmailRequest, CheckEmailResponse, RefreshSessionResponse
from interfaces.auth_mobile_service_interface import IAuthMobileService
from services.auth_mobile_service import AuthMobileService
from services.client_ip import extract_client_ip
from services.rate_limit_service import ip_action_quota

# Meme prefixe que auth_controller : les routes de l'entree de l'app s'y ajoutent.
router_auth_mobile = APIRouter(prefix="/auth", tags=["Auth"])

CHECK_EMAIL_MAX_PER_IP = 30
CHECK_EMAIL_WINDOW_SECONDS = 60 * 60
REFRESH_MAX_PER_IP = 120
REFRESH_WINDOW_SECONDS = 60 * 60


def get_auth_mobile_service():
    # Session creee ici (MVC2), comme get_order_edit_service.
    with LocalSession() as session:
        yield AuthMobileService(AuthMobileDaoBD(), session)


@router_auth_mobile.post("/check-email", response_model=CheckEmailResponse)
def check_email(data: CheckEmailRequest, request: Request, service: IAuthMobileService = Depends(get_auth_mobile_service)):
    """B12 : compte existant ou nouveau, pour l'ecran « Votre e-mail ». Debit limite par IP."""
    ip_action_quota.ensure_within_quota("check-email", extract_client_ip(request), CHECK_EMAIL_MAX_PER_IP, CHECK_EMAIL_WINDOW_SECONDS)
    return service.check_email(str(data.email))


@router_auth_mobile.post("/refresh", response_model=RefreshSessionResponse)
def refresh_session(
    request: Request,
    header_token: Optional[str] = Depends(oauth2_scheme),
    service: IAuthMobileService = Depends(get_auth_mobile_service),
):
    """Renouvelle le jeton de l'app (en-tete Bearer seulement, jamais le cookie du site)."""
    ip_action_quota.ensure_within_quota("refresh-session", extract_client_ip(request), REFRESH_MAX_PER_IP, REFRESH_WINDOW_SECONDS)
    if not header_token:
        raise HTTPException(401, "Session expiree ou invalidee")
    return service.refresh_session(header_token)
