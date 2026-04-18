from fastapi import APIRouter, Depends, HTTPException

from controllers.auth_controller import get_current_user
from dto.checkout_dto import CheckoutRequestDTO, CheckoutResponseDTO
from interfaces.checkout_service_interface import ICheckoutService
from dependencies import get_checkout_service


router_checkout = APIRouter(prefix="/api", tags=["Checkout"])


@router_checkout.post("/checkout", response_model=CheckoutResponseDTO)
def create_checkout(
    payload: CheckoutRequestDTO,
    current_user=Depends(get_current_user),
    service: ICheckoutService = Depends(get_checkout_service),
):
    try:
        with service:
            return service.create_checkout(int(current_user["sub"]), payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
