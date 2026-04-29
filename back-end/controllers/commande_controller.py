import base64

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from auth_dependencies import require_auth, require_permission
from controllers.auth_controller import get_current_user
from dependencies import get_cod_confirmation_service, get_voice_service
from dto.commande_dto import (
    CommandeCODDemainDTO,
    CommandeCheckoutDTO,
    CommandeJourDTO,
    ConfirmationCODResponseDTO,
    FicheClientDTO,
    TextBasketRequest,
    UpdateConfirmationCODDTO,
    VoiceBasketResponseDTO,
)
from interfaces.cod_confirmation_service_interface import ICODConfirmationService
from interfaces.commande_service_interface import ICommandeVocaleService

router_voice = APIRouter(prefix="/api", tags=["Voice AI"])


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


@router_voice.get("/commandes/cod/demain", response_model=list[CommandeCODDemainDTO])
def get_commandes_cod_demain(
    principal=Depends(require_permission("admin.panel.access", "orders.read")),
    service: ICODConfirmationService = Depends(get_cod_confirmation_service),
):
    _ = principal
    with service:
        return service.get_commandes_cod_demain()


@router_voice.patch("/commandes/cod/{commande_id}/confirmation", response_model=ConfirmationCODResponseDTO)
def update_confirmation_cod(
    commande_id: int,
    payload: UpdateConfirmationCODDTO,
    principal=Depends(require_permission("admin.panel.access", "orders.read")),
    service: ICODConfirmationService = Depends(get_cod_confirmation_service),
):
    with service:
        return service.update_confirmation_cod(
            commande_id=commande_id,
            statut=payload.statut,
            admin_id=principal.user_id,
        )


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
