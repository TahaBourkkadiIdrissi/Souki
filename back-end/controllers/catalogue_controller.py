from fastapi import APIRouter, Depends
from dto.product_dto import ProductResponseDTO
from interfaces.catalogue_service_interface import ICatalogueService
from dependencies import get_catalogue_service

router_catalogue = APIRouter(prefix="/api", tags=["Catalogue"])


@router_catalogue.get("/catalogue", response_model=list[ProductResponseDTO])
def get_catalogue(service: ICatalogueService = Depends(get_catalogue_service)):
    with service:
        return service.get_catalogue_complet()
