from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from dto.commande_dto import VoiceBasketResponseDTO, TextBasketRequest, CommandeCheckoutDTO
from interfaces.commande_service_interface import ICommandeVocaleService
from dependencies import get_voice_service
from controllers.auth_controller import get_current_user
import base64

router_voice = APIRouter(prefix="/api", tags=["Voice AI"])


@router_voice.post("/text-basket", response_model=VoiceBasketResponseDTO)
def process_text_basket(
    body: TextBasketRequest,
    current_user=Depends(get_current_user),
    service: ICommandeVocaleService = Depends(get_voice_service)
):
    with service:
        return service.traiter_texte(int(current_user["sub"]), body.texte)


@router_voice.post("/voice-basket", response_model=VoiceBasketResponseDTO)
def process_voice_basket(
    audio: UploadFile = File(...),
    current_user=Depends(get_current_user),
    service: ICommandeVocaleService = Depends(get_voice_service)
):
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
    if filename.endswith(".wav"):
        mime = "audio/wav"
    elif filename.endswith(".mp3"):
        mime = "audio/mp3"
    else:
        mime = "audio/webm"

    with service:
        return service.traiter_audio(int(current_user["sub"]), audio_b64, mime)

@router_voice.get("/commandes/{commande_id}", response_model=CommandeCheckoutDTO)
def get_commande_checkout(
    commande_id: int, 
    service: ICommandeVocaleService = Depends(get_voice_service)
):
    # Le "with" appelle __enter__ du service (qui ouvre la session DB)
    # et garantit __exit__ à la fin (qui ferme la session, même en cas d'erreur)
    with service:
        detail = service.get_commande_checkout(commande_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Commande non trouvée")
        return detail
