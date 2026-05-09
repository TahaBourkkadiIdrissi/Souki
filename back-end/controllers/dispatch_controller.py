from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth_dependencies import require_permission
from dependencies import get_dispatch_service
from interfaces.dispatch_service_interface import IDispatchService
from services.dispatch_service import DispatchNoLivreurError, DispatchServiceError


dispatch_router = APIRouter(prefix="/api/v1/admin/dispatch", tags=["Admin Dispatch"])
anomalies_router = APIRouter(prefix="/api/v1/admin/anomalies", tags=["Admin Anomalies"])


class ReassignCommandeRequest(BaseModel):
    nouvelle_tournee_id: int = Field(gt=0)


@dispatch_router.post("/run-daily")
def run_daily_dispatch(
    principal=Depends(require_permission("admin.panel.access")),
    service: IDispatchService = Depends(get_dispatch_service),
):
    target_date = date.today()
    try:
        with service:
            return service.generate_daily_routes(target_date)
    except DispatchNoLivreurError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DispatchServiceError as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 400), detail=str(exc)) from exc


@dispatch_router.get("/tournees")
def get_dispatch_tournees(
    principal=Depends(require_permission("admin.panel.access")),
    service: IDispatchService = Depends(get_dispatch_service),
):
    _ = principal
    target_date = date.today()
    try:
        with service:
            return service.get_tournees_details(target_date)
    except DispatchServiceError as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 400), detail=str(exc)) from exc


@dispatch_router.put("/commandes/{commande_id}/reassign")
def reassign_dispatch_commande(
    commande_id: int,
    payload: ReassignCommandeRequest,
    principal=Depends(require_permission("admin.panel.access")),
    service: IDispatchService = Depends(get_dispatch_service),
):
    _ = principal
    try:
        with service:
            return service.reassign_commande(
                commande_id=commande_id,
                nouvelle_tournee_id=payload.nouvelle_tournee_id,
            )
    except DispatchServiceError as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 400), detail=str(exc)) from exc


@anomalies_router.post("/{anomalie_id}/replanifier")
def replanifier_anomalie_logistique(
    anomalie_id: int,
    principal=Depends(require_permission("admin.panel.access")),
    service: IDispatchService = Depends(get_dispatch_service),
):
    try:
        with service:
            return service.resolve_anomalie_replanifier(
                anomalie_id=anomalie_id,
                admin_id=int(principal.user_id),
            )
    except DispatchServiceError as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 400), detail=str(exc)) from exc


@anomalies_router.post("/{anomalie_id}/annuler")
def annuler_anomalie_logistique(
    anomalie_id: int,
    principal=Depends(require_permission("admin.panel.access")),
    service: IDispatchService = Depends(get_dispatch_service),
):
    try:
        with service:
            return service.resolve_anomalie_annuler(
                anomalie_id=anomalie_id,
                admin_id=int(principal.user_id),
            )
    except DispatchServiceError as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 400), detail=str(exc)) from exc
