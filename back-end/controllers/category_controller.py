from fastapi import APIRouter, Depends, Response
from auth_dependencies import require_permission
from config import LocalSession
from dao.category_dao import CategoryDao
from dto.category_dto import CatalogueCategoryDTO, CategoryCreateDTO, CategoryDTO, CategoryProductsDTO, CategoryUpdateDTO
from interfaces.category_service_interface import ICategoryService
from services.category_service import CategoryService

category_router = APIRouter(tags=["Catégories"])


def get_category_service():
    with LocalSession() as session:
        yield CategoryService(CategoryDao(), session)


@category_router.get("/api/catalogue/categories", response_model=list[CatalogueCategoryDTO])
def catalogue_categories(service: ICategoryService = Depends(get_category_service)):
    return service.list_public()


@category_router.get("/api/admin/categories", response_model=list[CategoryDTO])
def list_categories(response: Response, principal=Depends(require_permission("admin.panel.access")), service: ICategoryService = Depends(get_category_service)):
    response.headers["Cache-Control"] = "no-store"
    return service.list_admin()


@category_router.post("/api/admin/categories", response_model=CategoryDTO, status_code=201)
def create_category(payload: CategoryCreateDTO, principal=Depends(require_permission("admin.panel.access")), service: ICategoryService = Depends(get_category_service)):
    return service.create(payload)


@category_router.put("/api/admin/categories/{category_id}", response_model=CategoryDTO)
def update_category(category_id: int, payload: CategoryUpdateDTO, principal=Depends(require_permission("admin.panel.access")), service: ICategoryService = Depends(get_category_service)):
    return service.update(category_id, payload)


@category_router.put("/api/admin/categories/{category_id}/produits", response_model=CategoryDTO)
def set_category_products(category_id: int, payload: CategoryProductsDTO, principal=Depends(require_permission("admin.panel.access")), service: ICategoryService = Depends(get_category_service)):
    return service.set_products(category_id, payload)
