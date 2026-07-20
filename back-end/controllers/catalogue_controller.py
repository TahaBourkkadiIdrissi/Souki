from fastapi import APIRouter, Depends
from config import LocalSession
from auth_dependencies import require_permission
from dto.product_dto import ProductResponseDTO, SuggestionsRequestDTO
from interfaces.catalogue_service_interface import ICatalogueService
from dependencies import get_catalogue_service

router_catalogue = APIRouter(prefix="/api", tags=["Catalogue"])


@router_catalogue.get("/catalogue", response_model=list[ProductResponseDTO])
def get_catalogue(service: ICatalogueService = Depends(get_catalogue_service)):
    with service:
        return service.get_catalogue_complet()


@router_catalogue.post("/catalogue/suggestions", response_model=list[ProductResponseDTO])
def get_suggestions(
    payload: SuggestionsRequestDTO,
    service: ICatalogueService = Depends(get_catalogue_service),
):
    session = LocalSession()
    try:
        return service.get_suggestions(
            session,
            payload.exclude_ids,
            payload.panier_total,
        )
    finally:
        session.close()


@router_catalogue.get("/user/suggestions", response_model=list[ProductResponseDTO])
def get_personalized_suggestions(
    principal=Depends(require_permission("profile.manage_self")),
    service: ICatalogueService = Depends(get_catalogue_service),
):
    """Suggestions personnalisees de l'utilisateur connecte (favoris + achats)."""
    session = LocalSession()
    try:
        return service.get_personalized_suggestions(
            session,
            principal.user_id,
            [],
            0.0,
        )
    finally:
        session.close()
