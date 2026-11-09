from abc import ABC, abstractmethod
from typing import Optional

from sqlalchemy.orm import Session

from entities.claim_entity import Claim


class IClaimPhotoDao(ABC):
    @abstractmethod
    def get_latest_user_claim_for_line(self, session: Session, user_id: int, commande_id: int,
                                       ligne_panier_id: int) -> Optional[Claim]:
        """Derniere reclamation du client sur cette ligne ; None si aucune n'est a lui."""
        pass

    @abstractmethod
    def get_claim(self, session: Session, claim_id: int) -> Optional[Claim]:
        pass
