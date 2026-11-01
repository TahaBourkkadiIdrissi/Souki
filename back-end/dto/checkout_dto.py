import re
from datetime import date, time
from typing import List, Optional

from pydantic import BaseModel, Field, PrivateAttr, validator

from dto.phone_validator import validate_moroccan_phone


class CheckoutItemDTO(BaseModel):
    product_id: int
    quantity: float


class CheckoutRequestDTO(BaseModel):
    _campaign_visit: Optional[str] = PrivateAttr(default=None)
    items: List[CheckoutItemDTO]
    creneau_livraison: str = "08:00"
    mode_paiement: str = "cash"
    # Deduit le solde Wallet du montant a payer ; le reste se regle a la livraison.
    utiliser_wallet: bool = False
    contact_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_instructions: Optional[str] = None
    brouillon_vocal_id: Optional[int] = None
    panier_id: Optional[int] = None

    @validator("contact_phone")
    def validate_contact_phone(cls, v):
        return validate_moroccan_phone(v)

    @validator("creneau_livraison")
    def validate_delivery_time(cls, value):
        normalized = value.strip() if isinstance(value, str) else ""
        if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", normalized):
            raise ValueError("L'heure de livraison doit être au format HH:MM")

        selected_time = time.fromisoformat(normalized)
        if selected_time < time(8, 0) or selected_time > time(15, 0):
            raise ValueError("La livraison doit être choisie entre 08:00 et 15:00")
        return normalized


class CheckoutLineDTO(BaseModel):
    product_id: int
    nom_produit: str
    prix_unitaire: float
    quantite: float


class CheckoutResponseDTO(BaseModel):
    date_livraison: Optional[date] = None
    status: str
    commande_id: int
    panier_id: int
    total_articles: int
    sous_total: float
    frais_livraison: float
    montant_total: float
    montant_wallet: float = 0.0
    reste_a_payer: float = 0.0
    mode_paiement: Optional[str] = None
    lignes: List[CheckoutLineDTO] = Field(default_factory=list)
    message: str
