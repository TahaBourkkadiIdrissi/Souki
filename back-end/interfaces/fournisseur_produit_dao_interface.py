from abc import ABC, abstractmethod
from typing import Optional

from sqlalchemy.orm import Session

from entities.fournisseur_produit_entity import FournisseurProduit


class IFournisseurProduitDao(ABC):

    @abstractmethod
    def list_by_fournisseur(self, session: Session, fournisseur_id: int) -> list[FournisseurProduit]:
        pass

    @abstractmethod
    def find(self, session: Session, fournisseur_id: int, produit_id: int) -> Optional[FournisseurProduit]:
        pass

    @abstractmethod
    def upsert(
        self,
        session: Session,
        fournisseur_id: int,
        produit_id: int,
        prix_gros: Optional[float],
        stock: float,
        is_active: bool,
    ) -> FournisseurProduit:
        pass

    @abstractmethod
    def delete(self, session: Session, fournisseur_id: int, produit_id: int) -> bool:
        pass

    @abstractmethod
    def count_active(self, session: Session, fournisseur_id: int) -> int:
        pass

    @abstractmethod
    def replace_selection(self, session: Session, fournisseur_id: int, produit_ids: list[int]) -> None:
        pass
