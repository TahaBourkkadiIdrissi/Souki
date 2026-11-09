from abc import ABC, abstractmethod
from datetime import datetime
from sqlalchemy.orm import Session

from entities.claim_entity import Claim


class IClaimAdminDao(ABC):
    @abstractmethod
    def list_recent(self, session: Session, limit: int) -> list[Claim]:
        """Dernieres reclamations, avec client, commande et produit."""
        pass

    @abstractmethod
    def stats_since(self, session: Session, since: datetime) -> tuple[int, float, int]:
        """(nombre, montant rembourse, nombre suspectes) depuis `since`."""
        pass

    @abstractmethod
    def existing_photo_names(self, session: Session, bucket: str, names: list[str]) -> set[str]:
        """Photos presentes dans le bucket parmi `names` (leve SQLAlchemyError si illisible)."""
        pass

    @abstractmethod
    def count_photos_since(self, session: Session, bucket: str, since: datetime) -> int:
        pass
