from abc import ABC, abstractmethod
from typing import Optional

from sqlalchemy.orm import Session

from entities.fournisseur_entity import Fournisseur


class IFournisseurDao(ABC):

    @abstractmethod
    def find_by_user_id(self, session: Session, user_id: int) -> Optional[Fournisseur]:
        pass

    @abstractmethod
    def find_by_statut(self, session: Session, statut: str) -> list[Fournisseur]:
        pass

    @abstractmethod
    def find_by_ville(self, session: Session, ville: str) -> list[Fournisseur]:
        pass

    @abstractmethod
    def exists_by_user_id(self, session: Session, user_id: int) -> bool:
        pass

    @abstractmethod
    def find_by_shop_slug(self, session: Session, shop_slug: str) -> Optional[Fournisseur]:
        pass

    @abstractmethod
    def count_by_statut(self, session: Session, statut: str) -> int:
        pass

    @abstractmethod
    def save(self, session: Session, fournisseur: Fournisseur) -> Fournisseur:
        pass
