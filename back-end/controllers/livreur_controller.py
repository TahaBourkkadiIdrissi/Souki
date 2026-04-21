from fastapi import APIRouter, Depends

from auth_dependencies import require_permission
from dependencies import get_livreur_service
from dto.livreur_dto import DemarrerTourneeResponseDTO, TourneeResponseDTO
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
