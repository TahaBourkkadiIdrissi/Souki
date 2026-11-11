from abc import ABC, abstractmethod

from dto.reorder_dto import ReorderResponseDTO


class IReorderService(ABC):
    @abstractmethod
    def get_reorder(self, user_id: int, order_id: int) -> ReorderResponseDTO:
        pass
