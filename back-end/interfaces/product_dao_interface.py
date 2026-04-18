from abc import ABC, abstractmethod
from typing import List, Optional

from sqlalchemy.orm import Session

from entities.product_entity import Product


class IProductDao(ABC):

    @abstractmethod
    def get_by_alias(self, session: Session, alias: str) -> Optional[Product]:
        """Cherche un produit par nom_fr ou nom_darija."""
        pass

    @abstractmethod
    def get_all(self, session: Session) -> List[Product]:
        """Retourne tous les produits du catalogue."""
        pass

    @abstractmethod
    def decrement_stock(self, session: Session, product_id: int, quantity: float) -> bool:
        """Decremente le stock d'un produit."""
        pass

    @abstractmethod
    def sync_catalogue(self, session: Session, products_data: List[dict]) -> None:
        """Synchronise le catalogue de reference avec la base."""
        pass
