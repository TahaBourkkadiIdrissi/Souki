from fastapi import APIRouter, Depends, Response
from auth_dependencies import require_permission
from config import LocalSession
from dao.panier_souki_dao import PanierSoukiDao
from dto.panier_souki_dto import PanierSoukiDTO, PanierSoukiInDTO
from interfaces.panier_souki_service_interface import IPanierSoukiService
from services.panier_souki_service import PanierSoukiService

panier_souki_router = APIRouter(tags=["Paniers SOUKI"])


def get_panier_souki_service():
    with LocalSession() as session:
        yield PanierSoukiService(PanierSoukiDao(), session)


@panier_souki_router.get("/api/paniers-souki", response_model=list[PanierSoukiDTO])
def lister_paniers_publics(response: Response, service: IPanierSoukiService = Depends(get_panier_souki_service)):
    # Prix du jour : jamais mis en cache.
    response.headers["Cache-Control"] = "no-store"
    return service.list_public()


@panier_souki_router.get("/api/admin/paniers-souki", response_model=list[PanierSoukiDTO])
def lister_paniers_admin(response: Response, principal=Depends(require_permission("admin.panel.access")), service: IPanierSoukiService = Depends(get_panier_souki_service)):
    response.headers["Cache-Control"] = "no-store"
    return service.list_admin()


@panier_souki_router.post("/api/admin/paniers-souki", response_model=PanierSoukiDTO, status_code=201)
def creer_panier(payload: PanierSoukiInDTO, principal=Depends(require_permission("admin.panel.access")), service: IPanierSoukiService = Depends(get_panier_souki_service)):
    return service.create(payload)


@panier_souki_router.put("/api/admin/paniers-souki/{panier_id}", response_model=PanierSoukiDTO)
def modifier_panier(panier_id: int, payload: PanierSoukiInDTO, principal=Depends(require_permission("admin.panel.access")), service: IPanierSoukiService = Depends(get_panier_souki_service)):
    return service.update(panier_id, payload)
