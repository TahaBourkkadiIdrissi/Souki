from fastapi import APIRouter, Depends

from auth_dependencies import require_permission
from dependencies import get_livreur_service
from dto.livreur_dto import (
    CodValidationResponseDTO,
    DeliveryEventRequestDTO,
    DeliveryEventResponseDTO,
    DemarrerTourneeResponseDTO,
    LivraisonDecisionRequestDTO,
    RamassageResponseDTO,
    TourneeRefusResponseDTO,
    TourneeResponseDTO,
)
from interfaces.livreur_service_interface import ILivreurService

router_livreur = APIRouter(prefix="/api/livreur", tags=["Livreur"])


@router_livreur.get("/tournee", response_model=TourneeResponseDTO)
def get_tournee(
    principal=Depends(require_permission("livreur.dashboard.access", "deliveries.read")),
    service: ILivreurService = Depends(get_livreur_service),
):
    with service:
        return service.get_tournee(principal.user_id)


@router_livreur.post("/demarrer-tournee", response_model=DemarrerTourneeResponseDTO)
def demarrer_tournee(
    principal=Depends(require_permission("livreur.dashboard.access", "deliveries.start_tour")),
    service: ILivreurService = Depends(get_livreur_service),
):
    with service:
        return service.demarrer_tournee(principal.user_id)


@router_livreur.post("/tournees/{tournee_id}/ramassage", response_model=RamassageResponseDTO)
def confirmer_ramassage(
    tournee_id: int,
    principal=Depends(require_permission("livreur.dashboard.access", "deliveries.start_tour")),
    service: ILivreurService = Depends(get_livreur_service),
):
    with service:
        return service.confirmer_ramassage(principal.user_id, tournee_id)


@router_livreur.post("/livraisons/{commande_id}/events", response_model=DeliveryEventResponseDTO)
def apply_delivery_event(
    commande_id: int,
    payload: DeliveryEventRequestDTO,
    principal=Depends(require_permission("livreur.dashboard.access", "deliveries.start_tour")),
    service: ILivreurService = Depends(get_livreur_service),
):
    with service:
        return service.apply_delivery_event(principal.user_id, commande_id, payload)


@router_livreur.post("/tournee/refuser", response_model=TourneeRefusResponseDTO)
def refuser_tournee(
    payload: LivraisonDecisionRequestDTO,
    principal=Depends(require_permission("livreur.dashboard.access", "deliveries.start_tour")),
    service: ILivreurService = Depends(get_livreur_service),
):
    with service:
        return service.refuser_tournee(principal.user_id, payload)


@router_livreur.post("/livraisons/{commande_id}/cod/validate", response_model=CodValidationResponseDTO)
def confirm_cod_payment(
    commande_id: int,
    principal=Depends(require_permission("livreur.dashboard.access", "deliveries.start_tour")),
    service: ILivreurService = Depends(get_livreur_service),
):
    with service:
        return service.confirm_cod_payment(principal.user_id, commande_id)
