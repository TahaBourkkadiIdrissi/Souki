from abc import ABC, abstractmethod

from dto.claim_admin_dto import ClaimAdminOverviewDTO


class IClaimAdminService(ABC):
    @abstractmethod
    def get_overview(self, limit: int) -> ClaimAdminOverviewDTO:
        pass
