from datetime import date
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from auth_dependencies import require_permission
from config import LocalSession, COOKIE_SECURE
from dao.campaign_dao import CampaignDao
from dto.campaign_dto import CampaignCreateDTO, CampaignUpdateDTO, CampaignDTO, CampaignStatsDTO, CampaignQrDTO, CampaignVersionDTO, CampaignOptionsDTO
from interfaces.campaign_service_interface import ICampaignService
from services.campaign_service import CampaignService

campaign_router = APIRouter(tags=["Campagnes"])


def get_campaign_service():
    with LocalSession() as session:
        yield CampaignService(CampaignDao(), session)


@campaign_router.get("/api/admin/campaigns", response_model=list[CampaignDTO])
def list_campaigns(response: Response, deleted: bool = False, principal=Depends(require_permission("admin.panel.access")), service: ICampaignService = Depends(get_campaign_service)):
    response.headers["Cache-Control"] = "no-store"
    return service.list(deleted=deleted)


@campaign_router.get("/api/admin/campaigns/options", response_model=CampaignOptionsDTO)
def campaign_options(response: Response, principal=Depends(require_permission("admin.panel.access")), service: ICampaignService = Depends(get_campaign_service)):
    response.headers["Cache-Control"] = "no-store"
    return service.options()


@campaign_router.delete("/api/admin/campaigns/{campaign_id}", response_model=CampaignDTO)
def trash_campaign(campaign_id: int, payload: CampaignVersionDTO, principal=Depends(require_permission("admin.panel.access")), service: ICampaignService = Depends(get_campaign_service)):
    return service.set_deleted(campaign_id, payload.expected_version, True)


@campaign_router.post("/api/admin/campaigns/{campaign_id}/restore", response_model=CampaignDTO)
def restore_campaign(campaign_id: int, payload: CampaignVersionDTO, principal=Depends(require_permission("admin.panel.access")), service: ICampaignService = Depends(get_campaign_service)):
    return service.set_deleted(campaign_id, payload.expected_version, False)


@campaign_router.post("/api/admin/campaigns", response_model=CampaignDTO, status_code=201)
def create_campaign(payload: CampaignCreateDTO, principal=Depends(require_permission("admin.panel.access")), service: ICampaignService = Depends(get_campaign_service)):
    return service.create(payload)


@campaign_router.put("/api/admin/campaigns/{campaign_id}", response_model=CampaignDTO)
def update_campaign(campaign_id: int, payload: CampaignUpdateDTO, principal=Depends(require_permission("admin.panel.access")), service: ICampaignService = Depends(get_campaign_service)):
    return service.update(campaign_id, payload)


@campaign_router.get("/api/admin/campaigns/{campaign_id}/stats", response_model=CampaignStatsDTO)
def campaign_stats(campaign_id: int, response: Response, start: date | None = None, end: date | None = None, principal=Depends(require_permission("admin.panel.access")), service: ICampaignService = Depends(get_campaign_service)):
    response.headers["Cache-Control"] = "no-store"
    return service.stats(campaign_id, start, end)


@campaign_router.get("/api/admin/campaigns/{campaign_id}/qr")
def campaign_qr(campaign_id: int, principal=Depends(require_permission("admin.panel.access")), service: ICampaignService = Depends(get_campaign_service)):
    return Response(service.qr(campaign_id), media_type="image/svg+xml", headers={"Cache-Control": "no-store", "Content-Disposition": f'attachment; filename="souki-qr-{campaign_id}.svg"'})


@campaign_router.get("/api/admin/campaigns/{campaign_id}/qr-preview", response_model=CampaignQrDTO)
def campaign_qr_preview(campaign_id: int, response: Response, principal=Depends(require_permission("admin.panel.access")), service: ICampaignService = Depends(get_campaign_service)):
    response.headers["Cache-Control"] = "no-store"
    return CampaignQrDTO(svg=service.qr(campaign_id))


@campaign_router.api_route("/api/campaigns/r/{slug}", methods=["GET", "HEAD"])
def resolve_campaign(slug: str, request: Request, service: ICampaignService = Depends(get_campaign_service)):
    result = service.resolve(slug, request.cookies.get("souki_qr_visitor"), request.headers.get("user-agent", ""), method=request.method, purpose=request.headers.get("purpose", ""), sec_purpose=request.headers.get("sec-purpose", ""), x_purpose=request.headers.get("x-purpose", ""), x_moz=request.headers.get("x-moz", ""))
    response = RedirectResponse(result.location, status_code=302, headers={"Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex"})
    if result.visitor_cookie:
        response.set_cookie("souki_qr_visitor", result.visitor_cookie, max_age=2592000, httponly=True, secure=COOKIE_SECURE, samesite="lax")
        response.set_cookie("souki_qr_visit", result.visit_cookie, max_age=2592000, httponly=True, secure=COOKIE_SECURE, samesite="lax")
    return response
