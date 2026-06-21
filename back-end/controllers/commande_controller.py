import base64
import io
import wave

from fastapi import APIRouter, Depends, File, HTTPException, Path, UploadFile

from auth_dependencies import require_auth, require_permission
from controllers.auth_controller import get_current_user
from dependencies import get_cod_confirmation_service, get_voice_service
from dto.commande_dto import (
    BatchConfirmationCODDTO,
    BatchConfirmationCODResponseDTO,
    CommandeCODDemainDTO,
    CommandeCheckoutDTO,
    CommandeHistoriqueDTO,
    CommandeJourDTO,
    ConfirmationCODResponseDTO,
    FicheClientDTO,
    TextBasketRequest,
    UpdateConfirmationCODDTO,
    VoiceBasketResponseDTO,
)
from interfaces.cod_confirmation_service_interface import ICODConfirmationService
from interfaces.commande_service_interface import ICommandeVocaleService
from services.scheduler_service import cod_alerte_18h_state

router_voice = APIRouter(prefix="/api", tags=["Voice AI"])
MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024
MAX_AUDIO_DURATION_SECONDS = 60
ALLOWED_AUDIO_FORMATS = {
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/webm",
    "audio/ogg",
}


def get_admin_user(user=Depends(get_current_user)):
    """
    Dependance pour verifier que l'utilisateur est ADMIN.
    Leve une exception 403 si ce n'est pas un admin.
    """
    if not user or user.primary_role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Acces refuse. Seul l'administrateur peut acceder a ce endpoint."
        )
    return user


def _normalize_audio_content_type(content_type: str | None) -> str:
    normalized = (content_type or "").split(";", 1)[0].strip().lower()
    if normalized == "audio/wave" or normalized == "audio/x-wav":
        return "audio/wav"
    if normalized == "audio/mpeg":
        return "audio/mp3"
    return normalized


def _validate_wav_duration(audio_bytes: bytes) -> None:
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wav_file:
            frame_rate = wav_file.getframerate()
            frame_count = wav_file.getnframes()
            if frame_rate <= 0:
                raise HTTPException(status_code=400, detail="Contenu audio invalide.")
            duration_seconds = frame_count / float(frame_rate)
    except HTTPException:
        raise
    except (wave.Error, EOFError, OSError) as exc:
        raise HTTPException(status_code=400, detail="Contenu audio invalide.") from exc

    if duration_seconds > MAX_AUDIO_DURATION_SECONDS:
        raise HTTPException(status_code=400, detail="Audio trop long. Maximum 60 secondes.")


def _validate_audio_upload(audio_bytes: bytes, content_type: str | None) -> str:
    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Audio trop grand. Maximum 10 Mo.")

    normalized_content_type = _normalize_audio_content_type(content_type)
    if normalized_content_type not in ALLOWED_AUDIO_FORMATS:
        raise HTTPException(status_code=400, detail="Format audio non supporte.")

    if audio_bytes[:4] == b"RIFF":
        _validate_wav_duration(audio_bytes)
        return "audio/wav"
    if audio_bytes[:3] == b"ID3" or audio_bytes[:2] in {b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"}:
        if normalized_content_type not in {"audio/mp3", "audio/mpeg"}:
            raise HTTPException(status_code=400, detail="Format audio non supporte.")
        return "audio/mp3"
    if audio_bytes[:4] == b"\x1aE\xdf\xa3":
        if normalized_content_type != "audio/webm":
            raise HTTPException(status_code=400, detail="Format audio non supporte.")
        return "audio/webm"
    if audio_bytes[:4] == b"OggS":
        if normalized_content_type != "audio/ogg":
            raise HTTPException(status_code=400, detail="Format audio non supporte.")
        return "audio/ogg"

    raise HTTPException(status_code=400, detail="Contenu audio invalide.")


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

    mime = _validate_audio_upload(audio_bytes, audio.content_type)
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

    with service:
        return service.traiter_audio(principal.user_id, audio_b64, mime)


@router_voice.get("/commandes", response_model=list[CommandeJourDTO])
@router_voice.get("/commandes/jour", response_model=list[CommandeJourDTO])
def get_commandes_du_jour(
    admin_user=Depends(get_admin_user),
    service: ICommandeVocaleService = Depends(get_voice_service)
):
    """
    Retourne les commandes du jour.

    ADMIN ONLY - Authentification requise
    """
    try:
        with service:
            return service.get_commandes_du_jour(service.session)  # type: ignore
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors du chargement des commandes du jour: {str(e)}")


@router_voice.get("/commandes/clients/{client_id}", response_model=FicheClientDTO)
def get_fiche_client(
    client_id: int,
    admin_user=Depends(get_admin_user),
    service: ICommandeVocaleService = Depends(get_voice_service)
):
    """
    Retourne la fiche complete d'un client.

    ADMIN ONLY - Authentification requise
    """
    try:
        with service:
            fiche = service.get_fiche_client(service.session, client_id)  # type: ignore
            if not fiche:
                raise HTTPException(status_code=404, detail="Client non trouve")
            return fiche
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors du chargement de la fiche client: {str(e)}")


@router_voice.get("/commandes/historique", response_model=list[CommandeHistoriqueDTO])
def get_historique_commandes_client(
    principal=Depends(require_permission("orders.read_self")),
    service: ICommandeVocaleService = Depends(get_voice_service)
):
    try:
        with service:
            return service.get_historique_client(principal.user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors du chargement de l'historique des commandes: {str(e)}")


@router_voice.delete("/commandes/historique/{commande_id}")
def delete_historique_commande_client(
    commande_id: int,
    principal=Depends(require_permission("orders.read_self")),
    service: ICommandeVocaleService = Depends(get_voice_service)
):
    try:
        with service:
            deleted = service.delete_historique_commande(principal.user_id, commande_id)
            if not deleted:
                raise HTTPException(status_code=404, detail="Commande introuvable dans votre historique")
            return {"success": True, "message": "Commande supprimee de l'historique."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression de l'historique: {str(e)}")


@router_voice.get("/commandes/cod/verouillees", response_model=list[CommandeCODDemainDTO])
@router_voice.get("/commandes/cod/demain", response_model=list[CommandeCODDemainDTO])  # DEPRECATED - utiliser /verouillees
def get_commandes_cod_verouillees(
    principal=Depends(require_permission("admin.panel.access", "orders.read")),
    service: ICODConfirmationService = Depends(get_cod_confirmation_service),
):
    _ = principal
    with service:
        return service.get_commandes_cod_demain()


@router_voice.patch("/commandes/cod/{commande_id}/confirmation", response_model=ConfirmationCODResponseDTO)
def update_confirmation_cod(
    payload: UpdateConfirmationCODDTO,
    commande_id: int = Path(..., ge=1, description="ID commande valide"),
    principal=Depends(require_permission("admin.panel.access")),
    service: ICODConfirmationService = Depends(get_cod_confirmation_service),
):
    with service:
        return service.update_confirmation_cod(
            commande_id=commande_id,
            statut=payload.statut,
            admin_id=principal.user_id,
        )


@router_voice.post("/commandes/cod/batch-confirmation", response_model=BatchConfirmationCODResponseDTO)
def batch_confirmation_cod(
    payload: BatchConfirmationCODDTO,
    principal=Depends(require_permission("admin.panel.access")),
    service: ICODConfirmationService = Depends(get_cod_confirmation_service),
):
    with service:
        return service.batch_confirmation_cod(
            payload=payload,
            admin_id=principal.user_id,
        )


@router_voice.get("/commandes/cod/alerte-18h")
def get_alerte_cod_18h(
    principal=Depends(require_permission("admin.panel.access")),
):
    _ = principal
    return cod_alerte_18h_state


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
