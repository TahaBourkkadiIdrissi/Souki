from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from config import SECRET_KEY, ALGORITHM
from dto.user_dto import UserRegister, LoginRequest, UserResponse, GoogleLoginRequest
from services.auth_service import AuthService

auth_router = APIRouter(prefix="/auth", tags=["Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)):
    """Middleware JWT — vérifie le token et retourne le payload."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Session expirée ou token invalide")


@auth_router.post("/register", response_model=UserResponse)
def register(data: UserRegister):
    user = AuthService().register(data)
    if not user:
        raise HTTPException(status_code=400, detail="Ce compte (email ou téléphone) existe déjà.")
    return user


@auth_router.post("/login")
def login(data: LoginRequest):
    token = AuthService().login(data)
    if not token:
        raise HTTPException(status_code=401, detail="Identifiants incorrects.")
    return {"access_token": token, "token_type": "bearer"}


@auth_router.post("/google-login")
def google_login(data: GoogleLoginRequest):
    token = AuthService().google_login(data.token)
    if not token:
        raise HTTPException(status_code=401, detail="Token Google invalide ou expiré.")
    return {"access_token": token, "token_type": "bearer"}


@auth_router.get("/me")
def get_me(user=Depends(get_current_user)):
    """Retourne le profil complet de l'utilisateur connecté."""
    try:
        user_data = AuthService().get_by_id(int(user['sub']))
        if not user_data:
            raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        return {
            "id": user_data.id,
            "email": user_data.email,
            "phone": user_data.phone,
            "role": user_data.role,
            "is_verified": user_data.is_verified
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="ID utilisateur invalide")
