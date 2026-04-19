from fastapi import APIRouter, HTTPException, Depends

from controllers.auth_controller import get_current_user
from dto.panier_dto import ManualBasketRequestDTO, ManualBasketResponseDTO, PanierDetailsDTO
from interfaces.panier_service_interface import IPanierService
from dependencies import get_panier_service


router_panier = APIRouter(prefix="/api", tags=["Panier"])


@router_panier.post("/manual-basket", response_model=ManualBasketResponseDTO)
def create_manual_basket(
    payload: ManualBasketRequestDTO,
    current_user=Depends(get_current_user),
    service: IPanierService = Depends(get_panier_service),
):
    """
    Crée un panier brouillon à partir d'items manuels.
    
    Le panier peut ensuite être validé via le checkout.
    
    Returns:
        ManualBasketResponseDTO avec ID du panier et détails des lignes
    """
    try:
        with service:
            return service.create_manual_basket(int(current_user["sub"]), payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router_panier.get("/paniers/{panier_id}", response_model=PanierDetailsDTO)
def get_panier_checkout(
    panier_id: int,
    service: IPanierService = Depends(get_panier_service),
):
    """
    Récupère les détails complets d'un panier avant checkout.
    
    Retourne toutes les lignes avec les prix et sous-totaux.
    """
    try:
        with service:
            return service.get_panier_details(panier_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
