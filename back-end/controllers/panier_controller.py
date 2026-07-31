from fastapi import APIRouter, Depends, HTTPException, Query

from auth_dependencies import require_auth, require_permission
from dependencies import get_dish_composition_service, get_ml_panier_service, get_panier_service
from dto.panier_dto import (
    DishCompositionResponseDTO,
    DishSummaryDTO,
    ManualBasketRequestDTO,
    ManualBasketResponseDTO,
    PanierDetailsDTO,
    PanierRequestDTO,
    PanierResponseDTO,
)
from interfaces.panier_service_interface import IPanierService
from services.dish_composition_service import DishCompositionService
from services.ml_panier_service import (
    BasketGenerationError,
    MLModelUnavailableError,
    MLPanierService,
)
from services.rate_limit_service import (
    AI_BASKET_QUOTA_ACTION,
    AI_BASKET_QUOTA_DETAIL,
    AI_BASKET_QUOTA_MAX_CALLS,
    AI_BASKET_QUOTA_WINDOW_SECONDS,
    user_action_quota,
)


router_panier = APIRouter(prefix="/api", tags=["Panier"])


@router_panier.post("/manual-basket", response_model=ManualBasketResponseDTO)
def create_manual_basket(
    payload: ManualBasketRequestDTO,
    principal=Depends(require_permission("checkout.create")),
    service: IPanierService = Depends(get_panier_service),
):
    try:
        with service:
            return service.create_manual_basket(principal.user_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router_panier.post("/paniers/generer", response_model=PanierResponseDTO)
def generer_panier_intelligent(
    payload: PanierRequestDTO,
    principal=Depends(require_permission("client.dashboard.access", "parent.dashboard.access", match="any")),
    service: MLPanierService = Depends(get_ml_panier_service),
):
    # VULN-008 : cette route embarque tout le catalogue dans le prompt systeme
    # Groq a chaque appel — c'est le prompt le plus cher de l'application. Elle
    # partage le quota horaire des autres generations IA.
    user_action_quota.ensure_within_quota(
        AI_BASKET_QUOTA_ACTION,
        principal.user_id,
        AI_BASKET_QUOTA_MAX_CALLS,
        AI_BASKET_QUOTA_WINDOW_SECONDS,
        AI_BASKET_QUOTA_DETAIL,
    )
    try:
        return service.generer_panier(payload, principal.user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except BasketGenerationError:
        raise HTTPException(
            status_code=503,
            detail="La generation du panier est momentanement indisponible. "
            "Veuillez reessayer ou composer votre panier manuellement.",
        )
    except MLModelUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la generation du panier intelligent: {str(e)}",
        )


# NB: routes declarees avant /paniers/{panier_id} pour que "plats" ne soit pas
# capture par le parametre de chemin entier.
@router_panier.get("/paniers/plats", response_model=list[DishSummaryDTO])
def list_dish_compositions(
    principal=Depends(require_permission("client.dashboard.access", "parent.dashboard.access", match="any")),
    service: DishCompositionService = Depends(get_dish_composition_service),
):
    _ = principal
    # Dropdown du panier IA: seuls les plats ayant au moins un ingredient
    # disponible au catalogue sont proposes (la voix garde les 100 plats).
    return service.list_dishes(only_with_available_ingredients=True)


@router_panier.get("/paniers/plats/{dish_id}", response_model=DishCompositionResponseDTO)
def get_dish_composition(
    dish_id: str,
    personnes: int = Query(4, ge=1, le=8),
    principal=Depends(require_permission("client.dashboard.access", "parent.dashboard.access", match="any")),
    service: DishCompositionService = Depends(get_dish_composition_service),
):
    _ = principal
    composition = service.resolve_composition(dish_id, personnes)
    if composition is None:
        raise HTTPException(status_code=404, detail="Plat introuvable.")
    return composition


@router_panier.get("/paniers/{panier_id}", response_model=PanierDetailsDTO)
def get_panier_checkout(
    panier_id: int,
    principal=Depends(require_auth),
    service: IPanierService = Depends(get_panier_service),
):
    # Anti-IDOR (VULN-004) : le panier est charge avec le proprietaire courant ;
    # le panier d'un autre utilisateur renvoie 404 (aucune fuite d'existence).
    try:
        with service:
            return service.get_panier_details(panier_id, principal.user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
