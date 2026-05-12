from typing import Optional

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

    class Config:
        from_attributes = True


class SuggestionsRequestDTO(BaseModel):
    exclude_ids: list[int] = Field(default_factory=list, max_length=20)
    panier_total: float = 0.0
