import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from auth_dependencies import oauth2_scheme, require_auth
from dto.settings_dto import (
    AddressUpdateDTO,
    ChangePasswordDTO,
    DeleteAccountDTO,
    NotificationPreferencesDTO,
    PersonalInfoUpdateDTO,
    WalletActivationDTO,
)
from services.settings_service import SettingsService
from services.user_session_service import UserSessionService

settings_router = APIRouter(prefix="/api/user", tags=["UserSettings"])
_service = SettingsService()


@settings_router.get("/profile")
def get_profile(principal=Depends(require_auth)):
    return _service.get_profile(principal.user_id)


@settings_router.get("/bootstrap")
def get_settings_bootstrap(token: str = Depends(oauth2_scheme), principal=Depends(require_auth)):
    current = UserSessionService().validate_token_session(token)
    current_session_id = current.id if current else None
    return _service.get_settings_bootstrap(principal.user_id, current_session_id)


@settings_router.put("/profile")
def update_profile(data: PersonalInfoUpdateDTO, principal=Depends(require_auth)):
    return _service.update_personal_info(principal.user_id, data)


@settings_router.put("/address")
def update_address(data: AddressUpdateDTO, principal=Depends(require_auth)):
    return _service.update_address(principal.user_id, data)


@settings_router.post("/profile/photo")
def upload_profile_photo(
    file: UploadFile = File(...),
    principal=Depends(require_auth),
):
    accepted = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in accepted:
        raise HTTPException(status_code=400, detail="Format de fichier non supporte")
    content = file.file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La taille maximale est 5MB")

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "profiles")
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Configuration supabase manquante")

    try:
        from supabase import create_client
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Client Supabase indisponible") from exc

    ext = "jpg"
    if file.content_type == "image/png":
        ext = "png"
    elif file.content_type == "image/webp":
        ext = "webp"
    filename = f"{principal.user_id}/{uuid.uuid4().hex}.{ext}"

    sb = create_client(supabase_url, supabase_key)
    sb.storage.from_(bucket).upload(filename, content, {"content-type": file.content_type, "upsert": "true"})
    public_url = sb.storage.from_(bucket).get_public_url(filename)

    return {"photo_url": public_url}


@settings_router.get("/notifications")
def get_notifications(principal=Depends(require_auth)):
    return _service.get_notifications(principal.user_id)


@settings_router.put("/notifications")
def update_notifications(data: NotificationPreferencesDTO, principal=Depends(require_auth)):
    return _service.update_notifications(principal.user_id, data)


@settings_router.post("/security/change-password")
def change_password(data: ChangePasswordDTO, principal=Depends(require_auth)):
    return _service.change_password(principal.user_id, data)


@settings_router.get("/sessions")
def get_sessions(token: str = Depends(oauth2_scheme), principal=Depends(require_auth)):
    current = UserSessionService().validate_token_session(token)
    current_session_id = current.id if current else None
    return _service.get_sessions(principal.user_id, current_session_id)


@settings_router.delete("/sessions/{session_id}")
def disconnect_one_session(session_id: int, principal=Depends(require_auth)):
    return _service.disconnect_session(principal.user_id, session_id)


@settings_router.delete("/sessions")
def disconnect_all_sessions(principal=Depends(require_auth)):
    return _service.disconnect_all_sessions(principal.user_id)


@settings_router.delete("/account")
def delete_account(data: DeleteAccountDTO, principal=Depends(require_auth)):
    if data.confirmation != "SUPPRIMER":
        raise HTTPException(status_code=400, detail="Confirmation invalide")
    return _service.delete_account(principal.user_id)


@settings_router.get("/wallet")
def get_wallet(principal=Depends(require_auth)):
    return _service.get_wallet(principal.user_id)


@settings_router.post("/wallet/activate")
def activate_wallet(data: WalletActivationDTO, principal=Depends(require_auth)):
    return _service.activate_wallet(principal.user_id, data)
