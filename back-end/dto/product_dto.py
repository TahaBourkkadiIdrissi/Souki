from typing import Literal, Optional
from datetime import datetime

from pydantic import BaseModel, Field


class ProductResponseDTO(BaseModel):
    id: int
    nom_fr: str
    nom_darija: str
    prix_kg: float
    prix_affiche: Optional[float] = None
    prix_khddar_estime: Optional[float] = None
    is_active: bool = True
    image_url: Optional[str] = None
    niveau: int = 2
    unite: str
    stock: float
    updated_at: Optional[datetime] = None
    availability: Literal["in_stock", "preorder", "out_of_stock"] = "out_of_stock"

    class Config:
        from_attributes = True


class SuggestionsRequestDTO(BaseModel):
    exclude_ids: list[int] = Field(default_factory=list, max_length=20)
    panier_total: float = 0.0
