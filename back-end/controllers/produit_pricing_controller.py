from fastapi import APIRouter, Depends

from auth_dependencies import require_permission
from config import LocalSession
from dependencies import get_produit_pricing_service
from dto.produit_pricing_dto import (
    ProduitPricingDTO,
    ProduitPricingListDTO,
    ProduitPricingUpdateDTO,
)
from interfaces.produit_pricing_service_interface import IProduitPricingService


router = APIRouter(prefix="/api/produits", tags=["Pricing Produits"])


@router.get("/pricing", response_model=ProduitPricingListDTO)
def get_produits_pricing(
    principal=Depends(require_permission("admin.panel.access")),
    service: IProduitPricingService = Depends(get_produit_pricing_service),
):
    _ = principal
    session = LocalSession()
    try:
        return service.get_all(session)
    finally:
        session.close()


@router.patch("/{produit_id}/pricing", response_model=ProduitPricingDTO)
def update_produit_pricing(
    produit_id: int,
    data: ProduitPricingUpdateDTO,
    principal=Depends(require_permission("admin.panel.access")),
    service: IProduitPricingService = Depends(get_produit_pricing_service),
):
    _ = principal
    session = LocalSession()
    try:
        return service.update_pricing(session, produit_id, data)
    finally:
        session.close()


@router.post("/pricing/recalculer")
def recalculer_produits_pricing(
    principal=Depends(require_permission("admin.panel.access")),
    service: IProduitPricingService = Depends(get_produit_pricing_service),
):
    _ = principal
    session = LocalSession()
    try:
        return service.recalculer_tous(session)
    finally:
        session.close()
