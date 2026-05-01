from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth_dependencies import require_permission
from dependencies import get_dispatch_service
from interfaces.dispatch_service_interface import IDispatchService
from services.dispatch_service import DispatchNoLivreurError, DispatchServiceError


dispatch_router = APIRouter(prefix="/api/v1/admin/dispatch", tags=["Admin Dispatch"])


class ReassignCommandeRequest(BaseModel):
    nouvelle_tournee_id: int = Field(gt=0)


@dispatch_router.post("/run-daily")
def run_daily_dispatch(
    principal=Depends(require_permission("admin.panel.access", "orders.assign_livreur")),
    service: IDispatchService = Depends(get_dispatch_service),
):
    target_date = date.today() + timedelta(days=1)
    try:
        with service:
            return service.generate_daily_routes(target_date)
    except DispatchNoLivreurError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DispatchServiceError as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 400), detail=str(exc)) from exc


@dispatch_router.get("/tournees")
def get_dispatch_tournees(
    target_date: Optional[date] = Query(default=None, alias="date"),
    principal=Depends(require_permission("admin.panel.access", "orders.assign_livreur")),
    service: IDispatchService = Depends(get_dispatch_service),
):
    _ = principal
    resolved_date = target_date or date.today() + timedelta(days=1)
    try:
        with service:
            return service.get_tournees_details(resolved_date)
    except DispatchServiceError as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 400), detail=str(exc)) from exc


@dispatch_router.put("/commandes/{commande_id}/reassign")
def reassign_dispatch_commande(
    commande_id: int,
    payload: ReassignCommandeRequest,
    principal=Depends(require_permission("admin.panel.access", "orders.assign_livreur")),
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
