from fastapi import APIRouter, Depends, HTTPException

from auth_dependencies import require_auth, require_permission
from dependencies import get_ml_panier_service, get_panier_service
from dto.panier_dto import (
    ManualBasketRequestDTO,
    ManualBasketResponseDTO,
    PanierDetailsDTO,
    PanierRequestDTO,
    PanierResponseDTO,
)
from interfaces.panier_service_interface import IPanierService
from services.ml_panier_service import MLModelUnavailableError, MLPanierService


router_panier = APIRouter(prefix="/api", tags=["Panier"])


@router_panier.post("/manual-basket", response_model=ManualBasketResponseDTO)
def create_manual_basket(
    payload: ManualBasketRequestDTO,
    principal=Depends(require_permission("checkout.create")),
    service: IPanierService = Depends(get_panier_service),
):
    try:
        with service:
            return service.create_manual_basket(principal.user_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router_panier.post("/paniers/generer", response_model=PanierResponseDTO)
def generer_panier_intelligent(
    payload: PanierRequestDTO,
    principal=Depends(require_permission("client.dashboard.access", "parent.dashboard.access", match="any")),
    service: MLPanierService = Depends(get_ml_panier_service),
):
    try:
        return service.generer_panier(payload, principal.user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except MLModelUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la generation du panier intelligent: {str(e)}",
        )


@router_panier.get("/paniers/{panier_id}", response_model=PanierDetailsDTO)
def get_panier_checkout(
    panier_id: int,
    principal=Depends(require_auth),
    service: IPanierService = Depends(get_panier_service),
):
    _ = principal
    try:
        with service:
            return service.get_panier_details(panier_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
