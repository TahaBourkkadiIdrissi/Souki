from abc import ABC, abstractmethod

from sqlalchemy.orm import Session

from dto.produit_pricing_dto import (
    ProduitPricingDTO,
    ProduitPricingListDTO,
    ProduitPricingUpdateDTO,
)


class IProduitPricingService(ABC):

    @abstractmethod
    def get_all(self, session: Session) -> ProduitPricingListDTO:
        pass

    @abstractmethod
    def update_pricing(
        self,
        session: Session,
        produit_id: int,
        data: ProduitPricingUpdateDTO,
    ) -> ProduitPricingDTO:
        pass

    @abstractmethod
    def recalculer_tous(self, session: Session) -> dict:
        pass
