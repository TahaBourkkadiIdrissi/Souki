from fastapi import APIRouter, Depends, Query

from auth_dependencies import require_permission
from config import LocalSession
from dao.claim_admin_dao import ClaimAdminDaoBD
from dto.claim_admin_dto import ClaimAdminOverviewDTO
from interfaces.claim_admin_service_interface import IClaimAdminService
from services.claim_admin_service import ClaimAdminService

router_claim_admin = APIRouter(prefix="/api/v1/admin", tags=["Claims"])


def get_claim_admin_service():
    # Session creee ici (MVC2), comme get_order_edit_service.
    with LocalSession() as session:
        yield ClaimAdminService(ClaimAdminDaoBD(), session)


@router_claim_admin.get("/claims", response_model=ClaimAdminOverviewDTO)
def list_admin_claims(
    limit: int = Query(100, ge=1, le=200),
    principal=Depends(require_permission("admin.panel.access", "orders.read")),
    service: IClaimAdminService = Depends(get_claim_admin_service),
):
    _ = principal
    return service.get_overview(limit)
