from abc import ABC, abstractmethod
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from entities.claim_entity import Claim


class IClaimDao(ABC):

    @abstractmethod
    def create_claim(
        self,
        session: Session,
        *,
        user_id: int,
        commande_id: int,
        ligne_panier_id: int,
        reason: str,
        quantity_claimed: Decimal,
        amount_refunded: Decimal,
        status: str,
        is_suspect: bool,
    ) -> Claim:
        pass

    @abstractmethod
    def count_recent_claims(
        self,
        session: Session,
        *,
        user_id: int,
        since: datetime,
    ) -> int:
        pass

    @abstractmethod
    def sum_claimed_quantity(
        self,
        session: Session,
        *,
        ligne_panier_id: int,
    ) -> Decimal:
        """Quantite deja remboursee sur cette ligne de panier (toutes reclamations)."""
        pass
