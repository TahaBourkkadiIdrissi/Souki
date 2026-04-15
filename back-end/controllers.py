from fastapi import APIRouter, HTTPException, Depends,UploadFile, File
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from config import SECRET_KEY, ALGORITHM
from dto import *
from services import AuthService, ProfileService,ICatalogueService, ICommandeVocaleService
from dependencies import get_catalogue_service, get_voice_service
import base64

auth_router = APIRouter(prefix="/auth", tags=["Auth"])
router_voice = APIRouter(prefix="/api", tags=["Voice AI"])
router_catalogue = APIRouter(prefix="/api", tags=["Catalogue"])
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
        # Si user est None, l'email ou le téléphone existe déjà en base
        raise HTTPException(status_code=400, detail="Ce compte (email ou téléphone) existe déjà.")
    return user

@auth_router.post("/login")
def login(data: LoginRequest):
    token = AuthService().login(data)
    if not token: 
        raise HTTPException(status_code=401, detail="Identifiants incorrects.")
    return {"access_token": token, "token_type": "bearer"}

@profile_router.post("/address")
def add_address(data: AddressDTO, user=Depends(get_current_user)):
    # user['sub'] contient l'ID de l'utilisateur stocké dans le token JWT
    res = ProfileService().add_address(int(user['sub']), data)
    if not res: 
        raise HTTPException(status_code=400, detail="Vous avez atteint la limite de 3 adresses.")
    return {"status": "success", "message": "Adresse ajoutée avec succès"}



@router_voice.post("/text-basket", response_model=VoiceBasketResponseDTO)
def process_text_basket(body: TextBasketRequest, service: ICommandeVocaleService = Depends(get_voice_service)):
    with service:
        return service.traiter_texte(body.texte)

@router_voice.post("/voice-basket", response_model=VoiceBasketResponseDTO)
def process_voice_basket(audio: UploadFile = File(...), service: ICommandeVocaleService = Depends(get_voice_service)):
    if not audio or not audio.filename:
        raise HTTPException(status_code=400, detail="Fichier audio manquant")
    try:
        audio_bytes = audio.file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Impossible de lire le fichier")
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Fichier audio vide")

    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    filename = audio.filename or "audio.webm"
    mime = "audio/wav" if filename.endswith(".wav") else "audio/mp3" if filename.endswith(".mp3") else "audio/webm"

    with service:
        return service.traiter_audio(audio_b64, mime)

@router_catalogue.get("/catalogue", response_model=list[ProductResponseDTO])
def get_catalogue(service: ICatalogueService = Depends(get_catalogue_service)):
    with service:
        return service.get_catalogue_complet()