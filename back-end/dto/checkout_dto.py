import re
from datetime import time
from typing import List, Optional

from pydantic import BaseModel, validator

from dto.phone_validator import validate_moroccan_phone


class CheckoutItemDTO(BaseModel):
    product_id: int
    quantity: float


class CheckoutRequestDTO(BaseModel):
    items: List[CheckoutItemDTO]
    creneau_livraison: str = "08:00"
    mode_paiement: str = "cash"
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


class CheckoutResponseDTO(BaseModel):
    status: str
    commande_id: int
    panier_id: int
    total_articles: int
    sous_total: float
    frais_livraison: float
    montant_total: float
    message: str
