from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from config import SECRET_KEY, ALGORITHM
from dto import *
from services import AuthService, ProfileService

auth_router = APIRouter(prefix="/auth", tags=["Auth"])
profile_router = APIRouter(prefix="/profile", tags=["Profile"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# Middleware de vérification de session
def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload # Retourne l'ID et le Role (ex: payload['sub'])
    except:
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

# --- NOUVELLE ROUTE GOOGLE ---
@auth_router.post("/google-login")
def google_login(data: GoogleLoginRequest):
    token = AuthService().google_login(data.token)
    if not token:
        raise HTTPException(status_code=401, detail="Token Google invalide ou expiré.")
    return {"access_token": token, "token_type": "bearer"}

@auth_router.get("/me")
def get_current_user_profile(user=Depends(get_current_user)):
    """Retourne les informations complètes de l'utilisateur connecté"""
    from config import LocalSession
    from dal import UserDao
    db = LocalSession()
    try:
        user_id = int(user['sub'])
        user_data = UserDao.read(db, user_id)
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
    finally:
        db.close()

@profile_router.post("/address")
def add_address(data: AddressDTO, user=Depends(get_current_user)):
    # user['sub'] contient l'ID de l'utilisateur stocké dans le token JWT
    res = ProfileService().add_address(int(user['sub']), data)
    if not res: 
        raise HTTPException(status_code=400, detail="Vous avez atteint la limite de 3 adresses.")
    return {"status": "success", "message": "Adresse ajoutée avec succès"}