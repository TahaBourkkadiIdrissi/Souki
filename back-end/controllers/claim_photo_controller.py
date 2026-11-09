from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from auth_dependencies import require_auth, require_permission
from config import LocalSession
from dao.claim_photo_dao import ClaimPhotoDaoBD
from dto.claim_photo_dto import ClaimPhotoUploadResponse, ClaimPhotoUrlResponse
from interfaces.claim_photo_service_interface import IClaimPhotoService
from services.claim_photo_service import ClaimPhotoService
from services.claim_photo_storage_service import (
    ALLOWED_CLAIM_PHOTO_MIME_TYPES,
    MAX_CLAIM_PHOTO_UPLOAD_BYTES,
    ClaimPhotoStorage,
)
from services.rate_limit_service import user_action_quota
from services.supabase_storage_service import avatar_storage_service

router_claim_photo = APIRouter(prefix="/api/v1", tags=["Claims"])

CLAIM_PHOTO_QUOTA_ACTION = "claim-photo"
CLAIM_PHOTO_QUOTA_MAX_CALLS = 20
CLAIM_PHOTO_QUOTA_WINDOW_SECONDS = 60 * 60


def get_claim_photo_service():
    # Session creee ici (MVC2), comme get_order_edit_service.
    with LocalSession() as session:
        yield ClaimPhotoService(ClaimPhotoDaoBD(), ClaimPhotoStorage(avatar_storage_service), session)


@router_claim_photo.post("/claims/photo", response_model=ClaimPhotoUploadResponse)
def upload_claim_photo(
    commande_id: int = Form(..., gt=0),
    ligne_panier_id: int = Form(..., gt=0),
    file: UploadFile = File(...),
    principal=Depends(require_auth),
    service: IClaimPhotoService = Depends(get_claim_photo_service),
):
    user_action_quota.ensure_within_quota(
        CLAIM_PHOTO_QUOTA_ACTION,
        principal.user_id,
        CLAIM_PHOTO_QUOTA_MAX_CALLS,
        CLAIM_PHOTO_QUOTA_WINDOW_SECONDS,
        "Trop de photos envoyées. Réessayez dans une heure.",
    )
    content_type = (file.content_type or "").split(";", 1)[0].strip().lower()
    if content_type not in ALLOWED_CLAIM_PHOTO_MIME_TYPES:
        raise HTTPException(400, "Photo invalide. Envoyez une photo JPEG, PNG ou WEBP.")
    # Lecture bornee : jamais plus de 8 Mo + 1 octet en memoire.
    content = file.file.read(MAX_CLAIM_PHOTO_UPLOAD_BYTES + 1)
    if len(content) > MAX_CLAIM_PHOTO_UPLOAD_BYTES:
        raise HTTPException(413, "Photo trop lourde. Maximum 8 Mo.")
    return service.attach_photo(principal.user_id, commande_id, ligne_panier_id, content)


@router_claim_photo.get("/admin/claims/{claim_id}/photo", response_model=ClaimPhotoUrlResponse)
def get_claim_photo(
    claim_id: int,
    principal=Depends(require_permission("admin.panel.access", "orders.read")),
    service: IClaimPhotoService = Depends(get_claim_photo_service),
):
    _ = principal
    return service.admin_photo_url(claim_id)
