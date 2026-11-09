from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class ClaimAdminItemDTO(BaseModel):
    id: int
    created_at: datetime
    commande_id: int
    date_livraison: Optional[date] = None
    client_id: int
    client_nom: Optional[str] = None
    produit: str
    unite: str
    reason: str
    quantity_claimed: float
    amount_refunded: float
    status: str
    is_suspect: bool
    # None : le stockage n'a pas pu etre interroge (la photo reste consultable a la demande).
    has_photo: Optional[bool] = None


class ClaimAdminOverviewDTO(BaseModel):
    total_30j: int
    montant_30j: float
    suspects_30j: int
    avec_photo_30j: Optional[int] = None
    items: list[ClaimAdminItemDTO]
