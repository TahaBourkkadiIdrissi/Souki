from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from config import SECRET_KEY, ALGORITHM
from dto import AddressDTO
from services import ProfileService
from controllers.auth_controller import get_current_user

profile_router = APIRouter(prefix="/profile", tags=["Profile"])


@profile_router.post("/address")
def add_address(data: AddressDTO, user=Depends(get_current_user)):
    """Ajoute une adresse pour l'utilisateur connecté"""
    res = ProfileService().add_address(int(user['sub']), data)
    if not res:
        raise HTTPException(status_code=400, detail="Vous avez atteint la limite de 3 adresses.")
    return {"status": "success", "message": "Adresse ajoutée avec succès"}
