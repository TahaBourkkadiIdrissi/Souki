from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class ClaimItemData:
    ligne_panier_id: int
    quantity_claimed: Decimal
    reason: str


@dataclass(frozen=True)
class ClaimRequestData:
    commande_id: int
    items: list[ClaimItemData]


@dataclass(frozen=True)
class ClaimProcessedItemDTO:
    claim_id: int
    ligne_panier_id: int
    amount_refunded: Decimal
    is_suspect: bool


@dataclass(frozen=True)
class ClaimProcessResultDTO:
    amount_refunded: Decimal
    new_wallet_balance: Decimal
    status: str
    is_suspect: bool
    items: list[ClaimProcessedItemDTO]
