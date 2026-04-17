from abc import ABC, abstractmethod
from sqlalchemy.orm import Session
from typing import Optional, List
from entities.product_entity import Product


class IProductDao(ABC):

    @abstractmethod
    def get_by_alias(self, session: Session, alias: str) -> Optional[Product]:
        """Cherche un produit par nom_fr ou nom_darija (insensible à la casse)."""
        pass

    @abstractmethod
    def get_all(self, session: Session) -> List[Product]:
        """Retourne tous les produits du catalogue."""
        pass

    @abstractmethod
    def decrement_stock(self, session: Session, product_id: int, quantity: float) -> bool:
        """Décrémente le stock d'un produit. Retourne False si stock insuffisant."""
        pass
