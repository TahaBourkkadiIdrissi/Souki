from fastapi import APIRouter, Depends, HTTPException, Request

from auth_dependencies import require_permission
from dependencies import get_checkout_service
from dto.checkout_dto import CheckoutRequestDTO, CheckoutResponseDTO
from interfaces.checkout_service_interface import ICheckoutService
from services.order_schedule import schedule_snapshot
from fastapi.responses import JSONResponse


router_checkout = APIRouter(prefix="/api", tags=["Checkout"])


@router_checkout.get("/order-schedule")
def get_order_schedule():
    return JSONResponse(schedule_snapshot(), headers={"Cache-Control": "no-store"})


@router_checkout.post("/checkout", response_model=CheckoutResponseDTO)
def create_checkout(
    payload: CheckoutRequestDTO,
    request: Request,
    principal=Depends(require_permission("checkout.create")),
    service: ICheckoutService = Depends(get_checkout_service),
):
    try:
        payload._campaign_visit = request.cookies.get("souki_qr_visit")
        with service:
            return service.create_checkout(principal.user_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
