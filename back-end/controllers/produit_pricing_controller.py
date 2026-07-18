from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from urllib.parse import urlparse

from auth_dependencies import require_permission
from config import LocalSession
from dependencies import get_produit_pricing_service
from dto.produit_pricing_dto import (
    ProductCreateDTO,
    ProductImageDTO,
    ProduitPricingDTO,
    ProduitPricingListDTO,
    ProduitPricingUpdateDTO,
)
from interfaces.produit_pricing_service_interface import IProduitPricingService
from services.supabase_storage_service import (
    MAX_PRODUCT_IMAGE_SIZE_BYTES,
    SupabaseStorageConfigError,
    SupabaseStorageError,
    avatar_storage_service,
)


router = APIRouter(prefix="/api/produits", tags=["Pricing Produits"])
MAX_IMAGE_URL_LENGTH = 500


def _validate_image_url(image_url: str) -> str:
    cleaned_url = image_url.strip()
    normalized_url = cleaned_url.lower()
    if normalized_url.startswith("data:image/"):
        raise HTTPException(
            status_code=400,
            detail="Utilisez l'upload fichier pour une image locale, ou collez une URL publique.",
        )
    if len(cleaned_url) > MAX_IMAGE_URL_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"L'URL image ne doit pas depasser {MAX_IMAGE_URL_LENGTH} caracteres.",
        )
    parsed_url = urlparse(cleaned_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise HTTPException(
            status_code=400,
            detail="L'URL image doit commencer par http:// ou https://.",
        )
    return cleaned_url


@router.post("", response_model=ProduitPricingDTO)
def create_produit(
    data: ProductCreateDTO,
    principal=Depends(require_permission("admin.panel.access")),
    service: IProduitPricingService = Depends(get_produit_pricing_service),
):
    session = LocalSession()
    try:
        return service.create_product(session, data)
    finally:
        session.close()


@router.get("/pricing", response_model=ProduitPricingListDTO)
def get_produits_pricing(
    principal=Depends(require_permission("admin.panel.access")),
    service: IProduitPricingService = Depends(get_produit_pricing_service),
):
    session = LocalSession()
    try:
        return service.get_all(session)
    finally:
        session.close()


@router.patch("/{produit_id}/pricing", response_model=ProduitPricingDTO)
def update_produit_pricing(
    produit_id: int,
    data: ProduitPricingUpdateDTO,
    principal=Depends(require_permission("admin.panel.access")),
    service: IProduitPricingService = Depends(get_produit_pricing_service),
):
    session = LocalSession()
    try:
        return service.update_pricing(session, produit_id, data)
    finally:
        session.close()


@router.delete("/{produit_id}")
def deactivate_produit(
    produit_id: int,
    principal=Depends(require_permission("admin.panel.access")),
    service: IProduitPricingService = Depends(get_produit_pricing_service),
):
    session = LocalSession()
    try:
        return service.delete_product(session, produit_id)
    finally:
        session.close()


@router.post("/{produit_id}/image/upload", response_model=ProduitPricingDTO)
async def upload_produit_image(
    produit_id: int,
    file: UploadFile = File(...),
    principal=Depends(require_permission("admin.panel.access")),
    service: IProduitPricingService = Depends(get_produit_pricing_service),
):
    # RISK-001 : lecture bornee (limite + 1 octet) -> 413 avant lecture complete.
    content = await file.read(MAX_PRODUCT_IMAGE_SIZE_BYTES + 1)
    if len(content) > MAX_PRODUCT_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image trop grande. Maximum 2 Mo.")
    try:
        image_url = avatar_storage_service.upload_product_image(
            content,
            file.filename or f"produit-{produit_id}",
            file.content_type or "image/jpeg",
            product_id=produit_id,
        )
    except SupabaseStorageConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SupabaseStorageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    session = LocalSession()
    try:
        return service.update_image(session, produit_id, image_url)
    finally:
        session.close()


@router.patch("/{produit_id}/image/url", response_model=ProduitPricingDTO)
def update_produit_image_url(
    produit_id: int,
    data: ProductImageDTO,
    principal=Depends(require_permission("admin.panel.access")),
    service: IProduitPricingService = Depends(get_produit_pricing_service),
):
    image_url = _validate_image_url(data.image_url)
    session = LocalSession()
    try:
        return service.update_image(session, produit_id, image_url)
    finally:
        session.close()


@router.post("/pricing/recalculer")
def recalculer_produits_pricing(
    principal=Depends(require_permission("admin.panel.access")),
    service: IProduitPricingService = Depends(get_produit_pricing_service),
):
    session = LocalSession()
    try:
        return service.recalculer_tous(session)
    finally:
        session.close()
