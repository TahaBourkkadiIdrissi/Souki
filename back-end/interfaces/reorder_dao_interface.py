from abc import ABC, abstractmethod
from typing import Optional

from sqlalchemy.orm import Session

from entities.commande_entity import Commande


class IReorderDao(ABC):
    @abstractmethod
    def get_owned_order_with_products(self, session: Session, order_id: int, user_id: int) -> Optional[Commande]:
        """Commande du client avec ses lignes et leurs produits ; None si elle n'est pas a lui."""
        pass
