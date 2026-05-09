from abc import ABC, abstractmethod
from typing import List, Optional

from sqlalchemy.orm import Session

from dto.produit_pricing_dto import ProduitPricingUpdateDTO


class IProduitPricingDao(ABC):

    @abstractmethod
    def get_all_produits_pricing(self, session: Session) -> List:
        pass

    @abstractmethod
    def get_produit_pricing(self, session: Session, produit_id: int) -> Optional[object]:
        pass

    @abstractmethod
    def update_produit_pricing(
        self,
        session: Session,
        produit_id: int,
        data: ProduitPricingUpdateDTO,
    ) -> None:
        pass

    @abstractmethod
    def update_prix_affiche(self, session: Session, produit_id: int, prix: float) -> None:
        pass
