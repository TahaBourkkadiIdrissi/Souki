from abc import ABC, abstractmethod

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
        self, user_id: int, payload: CheckoutRequestDTO
    ) -> CheckoutResponseDTO:
        pass
