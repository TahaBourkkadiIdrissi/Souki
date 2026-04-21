from fastapi import APIRouter, Depends, HTTPException

from auth_dependencies import require_permission
from dto.address_dto import AddressDTO
from services.profile_service import ProfileService

profile_router = APIRouter(prefix="/profile", tags=["Profile"])


@profile_router.post("/address")
def add_address(data: AddressDTO, principal=Depends(require_permission("profile.manage_self"))):
    res = ProfileService().add_address(principal.user_id, data)
    if not res:
        raise HTTPException(status_code=400, detail="Vous avez atteint la limite de 3 adresses.")
    return {"status": "success", "message": "Adresse ajoutée avec succès"}
