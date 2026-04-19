from fastapi import APIRouter, Depends, HTTPException

from controllers.auth_controller import get_current_user
from dependencies import get_livreur_service
from dto.livreur_dto import DemarrerTourneeResponseDTO, TourneeResponseDTO
from interfaces.livreur_service_interface import ILivreurService

router_livreur = APIRouter(prefix="/api/livreur", tags=["Livreur"])


def _get_current_livreur_id(user: dict) -> int:
    role = str(user.get("role") or "").upper()
    if role != "LIVREUR":
        raise HTTPException(status_code=403, detail="Acces reserve aux livreurs.")
    try:
        return int(user["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Session expirée ou token invalide")


@router_livreur.get("/tournee", response_model=TourneeResponseDTO)
def get_tournee(
    user=Depends(get_current_user),
    service: ILivreurService = Depends(get_livreur_service),
):
    livreur_id = _get_current_livreur_id(user)
    with service:
        return service.get_tournee(livreur_id)


@router_livreur.post("/demarrer-tournee", response_model=DemarrerTourneeResponseDTO)
def demarrer_tournee(
    user=Depends(get_current_user),
    service: ILivreurService = Depends(get_livreur_service),
):
    livreur_id = _get_current_livreur_id(user)
    with service:
        return service.demarrer_tournee(livreur_id)
