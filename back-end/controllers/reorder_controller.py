from fastapi import APIRouter, Depends

from auth_dependencies import require_permission
from config import LocalSession
from dao.reorder_dao import ReorderDaoBD
from dto.reorder_dto import ReorderResponseDTO
from interfaces.reorder_service_interface import IReorderService
from services.reorder_service import ReorderService

router_reorder = APIRouter(prefix="/api/commandes", tags=["Recommander"])


def get_reorder_service():
    # Session creee ici (MVC2), comme get_order_edit_service.
    with LocalSession() as session:
        yield ReorderService(ReorderDaoBD(), session)


@router_reorder.get("/{order_id}/recommander", response_model=ReorderResponseDTO)
def get_reorder(order_id: int,
                principal=Depends(require_permission("checkout.create")),
                service: IReorderService = Depends(get_reorder_service)):
    return service.get_reorder(principal.user_id, order_id)
