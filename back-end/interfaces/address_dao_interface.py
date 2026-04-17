from abc import ABC, abstractmethod
from sqlalchemy.orm import Session
from typing import Optional
from entities.address_entity import Address


class IAddressDao(ABC):

    @abstractmethod
    def get_count(self, db: Session, user_id: int) -> int:
        """Retourne le nombre d'adresses d'un utilisateur."""
        pass

    @abstractmethod
    def create(self, db: Session, addr: Address) -> Optional[Address]:
        """Persiste une nouvelle adresse. Retourne None en cas d'erreur."""
        pass
