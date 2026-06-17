from typing import List, Optional

from pydantic import BaseModel, validator

from dto.phone_validator import validate_moroccan_phone


class CheckoutItemDTO(BaseModel):
    product_id: int
    quantity: float


class CheckoutRequestDTO(BaseModel):
    items: List[CheckoutItemDTO]
    creneau_livraison: str = "Livraison demain"
    mode_paiement: str = "cash"
    contact_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_instructions: Optional[str] = None
    brouillon_vocal_id: Optional[int] = None

    @validator("contact_phone")
    def validate_contact_phone(cls, v):
        return validate_moroccan_phone(v)


class CheckoutResponseDTO(BaseModel):
    status: str
    commande_id: int
    panier_id: int
    total_articles: int
    sous_total: float
    frais_livraison: float
    montant_total: float
    message: str
