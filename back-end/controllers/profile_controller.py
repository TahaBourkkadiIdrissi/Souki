from fastapi import APIRouter, HTTPException, Depends
from dto.address_dto import AddressDTO
from services.profile_service import ProfileService
from controllers.auth_controller import get_current_user

profile_router = APIRouter(prefix="/profile", tags=["Profile"])


@profile_router.post("/address")
def add_address(data: AddressDTO, user=Depends(get_current_user)):
    res = ProfileService().add_address(int(user['sub']), data)
    if not res:
        raise HTTPException(status_code=400, detail="Vous avez atteint la limite de 3 adresses.")
    return {"status": "success", "message": "Adresse ajoutée avec succès"}
