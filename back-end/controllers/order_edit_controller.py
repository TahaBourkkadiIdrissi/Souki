from fastapi import APIRouter, Depends, Response
from auth_dependencies import require_permission
from config import LocalSession
from dao.checkout_dao import CheckoutDaoBD
from dao.order_edit_dao import OrderEditDaoBD
from dto.order_edit_dto import OrderEditRequestDTO, OrderEditSaveDTO, OrderEditResponseDTO, OrderCancelRequestDTO, OrderCancelResponseDTO
from interfaces.order_edit_service_interface import IOrderEditService
from services.order_edit_service import OrderEditService

router_order_edit = APIRouter(prefix="/api/commandes", tags=["Modification de commande"])


def get_order_edit_service():
    with LocalSession() as session:
        yield OrderEditService(OrderEditDaoBD(), CheckoutDaoBD(), session)


@router_order_edit.post("/{order_id}/annuler", response_model=OrderCancelResponseDTO)
def cancel_order(order_id: int, payload: OrderCancelRequestDTO,
                 principal=Depends(require_permission("checkout.create")),
                 service: IOrderEditService = Depends(get_order_edit_service)):
    return service.cancel(principal.user_id, order_id, payload)


@router_order_edit.get("/{order_id}/modification", response_model=OrderEditResponseDTO)
def get_order_edit(order_id: int, response: Response,
                   principal=Depends(require_permission("checkout.create")),
                   service: IOrderEditService = Depends(get_order_edit_service)):
    response.headers["Cache-Control"] = "no-store"
    return service.get_order(principal.user_id, order_id)


@router_order_edit.post("/{order_id}/modification/apercu", response_model=OrderEditResponseDTO)
def preview_order_edit(order_id: int, payload: OrderEditRequestDTO,
                       principal=Depends(require_permission("checkout.create")),
                       service: IOrderEditService = Depends(get_order_edit_service)):
    return service.preview(principal.user_id, order_id, payload)


@router_order_edit.patch("/{order_id}/modification", response_model=OrderEditResponseDTO)
def save_order_edit(order_id: int, payload: OrderEditSaveDTO,
                    principal=Depends(require_permission("checkout.create")),
                    service: IOrderEditService = Depends(get_order_edit_service)):
    return service.save(principal.user_id, order_id, payload)
