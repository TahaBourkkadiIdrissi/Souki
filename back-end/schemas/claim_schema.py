from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field, field_validator

from dto.claim_dto import ClaimItemData, ClaimRequestData


class ClaimReason(str, Enum):
    ABIME = "abime"
    POIDS_INCORRECT = "poids_incorrect"
    ERREUR_PRODUIT = "erreur_produit"
    PRODUIT_MANQUANT = "produit_manquant"
    QUALITE = "qualite"
    AUTRE = "autre"


class ClaimItemRequest(BaseModel):
    ligne_panier_id: int = Field(..., gt=0)
    quantity_claimed: Decimal = Field(..., gt=Decimal("0"))
    reason: ClaimReason

    @field_validator("quantity_claimed")
    @classmethod
    def validate_quantity_precision(cls, value: Decimal) -> Decimal:
        if value.as_tuple().exponent < -3:
            raise ValueError("La quantite reclamee ne peut pas depasser 3 decimales.")
        return value

    def to_data(self) -> ClaimItemData:
        return ClaimItemData(
            ligne_panier_id=self.ligne_panier_id,
            quantity_claimed=self.quantity_claimed,
            reason=self.reason.value,
        )


class ClaimCreateRequest(BaseModel):
    commande_id: int = Field(..., gt=0)
    items: list[ClaimItemRequest] = Field(..., min_length=1)

    def to_data(self) -> ClaimRequestData:
        return ClaimRequestData(
            commande_id=self.commande_id,
            items=[item.to_data() for item in self.items],
        )


class ClaimResponse(BaseModel):
    status: str
    amount_refunded: Decimal
    new_wallet_balance: Decimal
