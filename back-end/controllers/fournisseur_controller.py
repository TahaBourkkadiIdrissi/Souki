from fastapi import APIRouter, Depends, Query

from auth_dependencies import require_permission, require_role
from dependencies import get_fournisseur_service
from dto.supplier_dto import (
    AdminSupplierValidationDTO,
    PendingSupplierRequestDTO,
    SupplierOrdersDTO,
    SupplierPageDTO,
    SupplierProfileDTO,
    SupplierRequestDTO,
    SupplierStatsDTO,
    SupplierUpdateDTO,
)
from interfaces.fournisseur_service_interface import IFournisseurService

router_supplier = APIRouter(prefix="/api/supplier", tags=["Supplier"])
router_admin_supplier = APIRouter(prefix="/api/admin/suppliers", tags=["Admin Suppliers"])


@router_supplier.post("/request", response_model=SupplierProfileDTO)
def submit_supplier_request(
    payload: SupplierRequestDTO,
    principal=Depends(require_role("CLIENT")),
    service: IFournisseurService = Depends(get_fournisseur_service),
):
    with service:
        return service.submit_supplier_request(principal.user_id, payload)


@router_supplier.get("/profile", response_model=SupplierProfileDTO)
def get_supplier_profile(
    principal=Depends(require_role("FOURNISSEUR")),
    service: IFournisseurService = Depends(get_fournisseur_service),
):
    with service:
        return service.get_supplier_profile(principal.user_id)


@router_supplier.put("/profile", response_model=SupplierProfileDTO)
def update_supplier_profile(
    payload: SupplierUpdateDTO,
    principal=Depends(require_permission("supplier.profile.update")),
    service: IFournisseurService = Depends(get_fournisseur_service),
):
    with service:
        return service.update_supplier_profile(principal.user_id, payload)


@router_supplier.get("/stats", response_model=SupplierStatsDTO)
def get_supplier_stats(
    principal=Depends(require_permission("supplier.stats.read")),
    service: IFournisseurService = Depends(get_fournisseur_service),
):
    with service:
        return service.get_supplier_stats(principal.user_id)


@router_supplier.get("/orders", response_model=SupplierOrdersDTO)
def get_supplier_orders(
    principal=Depends(require_permission("supplier.orders.read")),
    service: IFournisseurService = Depends(get_fournisseur_service),
):
    with service:
        return service.get_supplier_orders(principal.user_id)


@router_admin_supplier.get("/pending", response_model=list[PendingSupplierRequestDTO])
def get_pending_supplier_requests(
    principal=Depends(require_permission("admin.panel.access")),
    service: IFournisseurService = Depends(get_fournisseur_service),
):
    _ = principal
    with service:
        return service.get_pending_requests()


@router_admin_supplier.get("", response_model=SupplierPageDTO)
def get_all_fournisseurs(
    statut: str | None = Query(default=None),
    ville: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    principal=Depends(require_permission("admin.panel.access")),
    service: IFournisseurService = Depends(get_fournisseur_service),
):
    _ = principal
    with service:
        return service.get_all_fournisseurs(
            statut=statut,
            ville=ville,
            search=search,
            page=page,
            page_size=page_size,
        )


@router_admin_supplier.post("/validate", response_model=SupplierProfileDTO)
def validate_supplier_request(
    payload: AdminSupplierValidationDTO,
    principal=Depends(require_permission("admin.panel.access")),
    service: IFournisseurService = Depends(get_fournisseur_service),
):
    with service:
        return service.validate_supplier_request(principal.user_id, payload)


@router_admin_supplier.put("/{supplier_user_id}/suspend", response_model=SupplierProfileDTO)
def suspend_supplier(
    supplier_user_id: int,
    principal=Depends(require_permission("admin.panel.access")),
    service: IFournisseurService = Depends(get_fournisseur_service),
):
    with service:
        return service.suspend_supplier(principal.user_id, supplier_user_id)


@router_admin_supplier.put("/{supplier_user_id}/reactivate", response_model=SupplierProfileDTO)
def reactivate_supplier(
    supplier_user_id: int,
    principal=Depends(require_permission("admin.panel.access")),
    service: IFournisseurService = Depends(get_fournisseur_service),
):
    with service:
        return service.reactivate_supplier(principal.user_id, supplier_user_id)
