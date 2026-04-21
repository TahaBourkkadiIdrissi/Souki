import base64

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from auth_dependencies import require_auth, require_permission
from dependencies import get_voice_service
from dto.commande_dto import CommandeCheckoutDTO, TextBasketRequest, VoiceBasketResponseDTO
from interfaces.commande_service_interface import ICommandeVocaleService

router_voice = APIRouter(prefix="/api", tags=["Voice AI"])


@router_voice.post("/text-basket", response_model=VoiceBasketResponseDTO)
def process_text_basket(
    body: TextBasketRequest,
    principal=Depends(require_permission("client.dashboard.access", "parent.dashboard.access", match="any")),
    service: ICommandeVocaleService = Depends(get_voice_service)
):
    with service:
        return service.traiter_texte(principal.user_id, body.texte)


@router_voice.post("/voice-basket", response_model=VoiceBasketResponseDTO)
def process_voice_basket(
    audio: UploadFile = File(...),
    principal=Depends(require_permission("client.dashboard.access", "parent.dashboard.access", match="any")),
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
        return service.traiter_audio(principal.user_id, audio_b64, mime)


@router_voice.get("/commandes/{commande_id}", response_model=CommandeCheckoutDTO)
def get_commande_checkout(
    commande_id: int,
    principal=Depends(require_auth),
    service: ICommandeVocaleService = Depends(get_voice_service)
):
    _ = principal
    with service:
        detail = service.get_commande_checkout(commande_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Commande non trouvée")
        return detail
