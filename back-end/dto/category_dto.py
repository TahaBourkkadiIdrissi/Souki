from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator

# Icones proposees dans l'admin ; le client et l'admin les associent a lucide-react.
CategoryIcon = Literal[
    "panier", "pomme", "carotte", "feuille", "agrume", "raisin", "cerise", "banane",
    "salade", "pousse", "ble", "soleil", "flocon", "fleur", "etiquette",
]


class CategoryWriteDTO(BaseModel):
    nom: str = Field(min_length=1, max_length=80)
    icone: CategoryIcon | None = None
    produit_vedette_id: int | None = Field(default=None, ge=1)
    ordre: int = Field(default=0, ge=0, le=999)
    actif: bool = True


class CategoryCreateDTO(CategoryWriteDTO):
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,46}[a-z0-9]$")

    @field_validator("slug", mode="before")
    @classmethod
    def normalize_slug(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class CategoryUpdateDTO(CategoryWriteDTO):
    pass


class CategoryProductsDTO(BaseModel):
    product_ids: list[int] = Field(default_factory=list, max_length=1000)


class CategoryDTO(CategoryWriteDTO):
    id: int
    slug: str
    created_at: datetime
    product_ids: list[int] = Field(default_factory=list)


class CatalogueCategoryDTO(BaseModel):
    id: int
    slug: str
    nom: str
    icone: str | None = None
    produit_vedette_id: int | None = None
    ordre: int
    product_ids: list[int] = Field(default_factory=list)
