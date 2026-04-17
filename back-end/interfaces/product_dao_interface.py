from abc import ABC, abstractmethod
from typing import Optional, List
from sqlalchemy.orm import Session
from entities import Product


class IProductDao(ABC):
    @abstractmethod
    def get_by_alias(self, session: Session, alias: str) -> Optional[Product]:
        """Récupère un produit par son alias (nom_fr ou nom_darija)"""
        pass

    @abstractmethod
    def get_all(self, session: Session) -> List[Product]:
        """Récupère tous les produits"""
        pass

    @abstractmethod
    def decrement_stock(self, session: Session, product_id: int, quantity: float) -> bool:
        """Décrémente le stock d'un produit"""
        pass
