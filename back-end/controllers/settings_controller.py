from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from auth_dependencies import require_auth
from dto.settings_dto import (
    AddressUpdateDTO,
    ChangePasswordDTO,
    DeleteAccountDTO,
    NotificationPreferencesDTO,
    PersonalInfoUpdateDTO,
    WalletActivationDTO,
)
from services.settings_service import SettingsService
from services.supabase_storage_service import (
    ALLOWED_AVATAR_MIME_TYPES,
    MAX_AVATAR_SIZE_BYTES,
    SupabaseStorageConfigError,
    SupabaseStorageError,
)

settings_router = APIRouter(prefix="/api/user", tags=["UserSettings"])
_service = SettingsService()


@settings_router.get("/profile")
def get_profile(principal=Depends(require_auth)):
    return _service.get_profile(principal.user_id)


@settings_router.get("/bootstrap")
def get_settings_bootstrap(principal=Depends(require_auth)):
    # require_auth attache deja l'id de la session courante au principal.
    current_session_id = getattr(principal, "session_id", None)
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
    if file.content_type not in ALLOWED_AVATAR_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Choisissez une image JPG, PNG ou WEBP.")
    # RISK-001 : lecture bornee (limite + 1 octet) -> 413 avant lecture complete.
    # La signature reelle est ensuite verifiee et l'image reencodee (metadonnees
    # supprimees) par SupabaseStorageService.upload_avatar.
    content = file.file.read(MAX_AVATAR_SIZE_BYTES + 1)
    if len(content) > MAX_AVATAR_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="L'image ne doit pas depasser 2 Mo.")

    try:
        return _service.upload_profile_photo(principal.user_id, content, file.content_type)
    except SupabaseStorageConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SupabaseStorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


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
def get_sessions(principal=Depends(require_auth)):
    current_session_id = getattr(principal, "session_id", None)
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


@settings_router.post("/parrainage/generate")
def generate_parrainage_code(principal=Depends(require_auth)):
    return _service.generate_parrainage_code(principal.user_id)
