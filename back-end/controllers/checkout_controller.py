from fastapi import APIRouter, Depends, HTTPException

from auth_dependencies import require_permission
from dependencies import get_checkout_service
from dto.checkout_dto import CheckoutRequestDTO, CheckoutResponseDTO
from interfaces.checkout_service_interface import ICheckoutService


router_checkout = APIRouter(prefix="/api", tags=["Checkout"])


@router_checkout.post("/checkout", response_model=CheckoutResponseDTO)
def create_checkout(
    payload: CheckoutRequestDTO,
    principal=Depends(require_permission("checkout.create")),
    service: ICheckoutService = Depends(get_checkout_service),
):
    try:
        with service:
            return service.create_checkout(principal.user_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
