from abc import ABC, abstractmethod
from dto.order_edit_dto import OrderEditRequestDTO, OrderEditSaveDTO, OrderEditResponseDTO, OrderCancelRequestDTO, OrderCancelResponseDTO


class IOrderEditService(ABC):
    @abstractmethod
    def cancel(self, user_id: int, order_id: int, payload: OrderCancelRequestDTO) -> OrderCancelResponseDTO:
        pass

    @abstractmethod
    def get_order(self, user_id: int, order_id: int) -> OrderEditResponseDTO:
        pass

    @abstractmethod
    def preview(self, user_id: int, order_id: int, payload: OrderEditRequestDTO) -> OrderEditResponseDTO:
        pass

    @abstractmethod
    def save(self, user_id: int, order_id: int, payload: OrderEditSaveDTO) -> OrderEditResponseDTO:
        pass
