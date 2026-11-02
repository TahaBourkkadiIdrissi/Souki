from abc import ABC, abstractmethod
from datetime import date
from typing import Optional

from dto.checkout_dto import CheckoutRequestDTO, CheckoutResponseDTO


class ICheckoutService(ABC):

    @abstractmethod
    def __enter__(self):
        pass

    @abstractmethod
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    @abstractmethod
    def create_checkout(
        self, user_id: int, payload: CheckoutRequestDTO, system_delivery_date: Optional[date] = None
    ) -> CheckoutResponseDTO:
        pass
