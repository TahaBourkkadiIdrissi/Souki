from datetime import date

from fastapi import APIRouter, Depends, Query

from auth_dependencies import require_permission
from config import LocalSession
from dependencies import get_dispatch_service
from dto.admin_exception_dto import (
    CommandeAdminActionDTO,
    CommandeExceptionsPageDTO,
    RattacherFournisseurDTO,
    ReassignerCommandeDTO,
)
from interfaces.dispatch_service_interface import IDispatchService
from services.admin_exception_service import AdminExceptionService
from services.dispatch_service import DispatchServiceError
from fastapi import HTTPException


router_admin_exceptions = APIRouter(
    prefix="/api/admin/commandes",
    tags=["Admin Commandes Exceptions"],
)


@router_admin_exceptions.get("/exceptions", response_model=CommandeExceptionsPageDTO)
def get_commandes_exceptions(
    raison: str | None = Query(default=None),
    search: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    principal=Depends(require_permission("admin.panel.access")),
):
    session = LocalSession()
    try:
        return AdminExceptionService(session).list_exceptions(
            raison=raison,
            search=search,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
    finally:
        session.close()


@router_admin_exceptions.post(
    "/{commande_id}/rattacher-fournisseur",
    response_model=CommandeAdminActionDTO,
)
def rattacher_fournisseur(
    commande_id: int,
    payload: RattacherFournisseurDTO,
    principal=Depends(require_permission("admin.panel.access")),
):
    session = LocalSession()
    try:
        return AdminExceptionService(session).rattacher_fournisseur(
            commande_id,
            payload.fournisseur_id,
        )
    finally:
        session.close()


@router_admin_exceptions.post("/{commande_id}/replanifier", response_model=CommandeAdminActionDTO)
def replanifier_commande(
    commande_id: int,
    principal=Depends(require_permission("admin.panel.access")),
):
    session = LocalSession()
    try:
        return AdminExceptionService(session).replanifier(commande_id, int(principal.user_id))
    finally:
        session.close()


@router_admin_exceptions.post("/{commande_id}/annuler", response_model=CommandeAdminActionDTO)
def annuler_commande(
    commande_id: int,
    principal=Depends(require_permission("admin.panel.access")),
):
    session = LocalSession()
    try:
        return AdminExceptionService(session).annuler(commande_id, int(principal.user_id))
    finally:
        session.close()


@router_admin_exceptions.post("/{commande_id}/reassigner")
def reassigner_commande(
    commande_id: int,
    payload: ReassignerCommandeDTO,
    principal=Depends(require_permission("admin.panel.access")),
    dispatch_service: IDispatchService = Depends(get_dispatch_service),
):
    try:
        with dispatch_service:
            return dispatch_service.reassign_commande(
                commande_id=commande_id,
                nouvelle_tournee_id=payload.nouvelle_tournee_id,
            )
    except DispatchServiceError as exc:
        raise HTTPException(
            status_code=getattr(exc, "status_code", 400),
            detail=str(exc),
        ) from exc
