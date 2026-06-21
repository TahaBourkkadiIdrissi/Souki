from abc import ABC, abstractmethod

from dto.claim_dto import ClaimProcessResultDTO, ClaimRequestData


class IClaimService(ABC):

    @abstractmethod
    def __enter__(self):
        pass

    @abstractmethod
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    @abstractmethod
    def process_claim(self, user_id: int, claim_request_data: ClaimRequestData) -> ClaimProcessResultDTO:
        pass
