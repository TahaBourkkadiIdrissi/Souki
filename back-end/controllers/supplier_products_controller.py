from typing import List

from fastapi import APIRouter, Depends

from auth_dependencies import require_permission
from dependencies import get_fournisseur_produit_service
from dto.supplier_dto import (
    SupplierCatalogueItemDTO,
    SupplierProductCreateDTO,
    SupplierProductOfferDTO,
    SupplierProductSelectionDTO,
    SupplierProductUpdateDTO,
    SupplierProductsListDTO,
)
from interfaces.fournisseur_produit_service_interface import IFournisseurProduitService

router_supplier_products = APIRouter(prefix="/api/supplier/products", tags=["Supplier Products"])


@router_supplier_products.get("", response_model=SupplierProductsListDTO)
def list_supplier_products(
    principal=Depends(require_permission("supplier.products.read")),
    service: IFournisseurProduitService = Depends(get_fournisseur_produit_service),
):
    with service:
        return service.list_products(principal.user_id)


@router_supplier_products.get("/catalogue", response_model=List[SupplierCatalogueItemDTO])
def list_catalogue(
    principal=Depends(require_permission("supplier.products.read")),
    service: IFournisseurProduitService = Depends(get_fournisseur_produit_service),
):
    with service:
        return service.list_catalogue(principal.user_id)


@router_supplier_products.post("", response_model=SupplierProductOfferDTO)
def add_product(
    payload: SupplierProductCreateDTO,
    principal=Depends(require_permission("supplier.products.create")),
    service: IFournisseurProduitService = Depends(get_fournisseur_produit_service),
):
    with service:
        return service.add_product(principal.user_id, payload)


@router_supplier_products.put("/selection", response_model=SupplierProductsListDTO)
def set_selection(
    payload: SupplierProductSelectionDTO,
    principal=Depends(require_permission("supplier.products.create")),
    service: IFournisseurProduitService = Depends(get_fournisseur_produit_service),
):
    with service:
        return service.set_selection(principal.user_id, payload)


@router_supplier_products.put("/{produit_id}", response_model=SupplierProductOfferDTO)
def update_product(
    produit_id: int,
    payload: SupplierProductUpdateDTO,
    principal=Depends(require_permission("supplier.products.update")),
    service: IFournisseurProduitService = Depends(get_fournisseur_produit_service),
):
    with service:
        return service.update_product(principal.user_id, produit_id, payload)


@router_supplier_products.delete("/{produit_id}")
def remove_product(
    produit_id: int,
    principal=Depends(require_permission("supplier.products.delete")),
    service: IFournisseurProduitService = Depends(get_fournisseur_produit_service),
):
    with service:
        service.remove_product(principal.user_id, produit_id)
    return {"status": "success"}
