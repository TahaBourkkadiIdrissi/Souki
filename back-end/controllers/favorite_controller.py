from fastapi import APIRouter, Depends, HTTPException

from auth_dependencies import require_permission
from dto.product_dto import ProductResponseDTO
from services.favorite_service import FavoriteService
from services.onboarding_service import OnboardingService

favorite_router = APIRouter(prefix="/api/user", tags=["Favorites"])


@favorite_router.get("/favorites", response_model=list[ProductResponseDTO])
def list_favorites(principal=Depends(require_permission("profile.manage_self"))):
    return FavoriteService().list_favorites(principal.user_id)


@favorite_router.post("/favorites/{produit_id}")
def add_favorite(
    produit_id: int,
    principal=Depends(require_permission("profile.manage_self")),
):
    try:
        FavoriteService().add_favorite(principal.user_id, produit_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return {"status": "success"}


@favorite_router.delete("/favorites/{produit_id}")
def remove_favorite(
    produit_id: int,
    principal=Depends(require_permission("profile.manage_self")),
):
    FavoriteService().remove_favorite(principal.user_id, produit_id)
    return {"status": "success"}


@favorite_router.post("/onboarding")
def complete_onboarding(principal=Depends(require_permission("profile.manage_self"))):
    """Marque l'onboarding comme termine pour le compte courant (idempotent)."""
    if not OnboardingService().complete(principal.user_id):
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return {"status": "success", "onboarding_completed": True}
