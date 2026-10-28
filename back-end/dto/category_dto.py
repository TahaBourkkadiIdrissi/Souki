from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class CategoryWriteDTO(BaseModel):
    nom: str = Field(min_length=1, max_length=80)
    emoji: str | None = Field(default=None, max_length=16)
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
    emoji: str | None = None
    ordre: int
    product_ids: list[int] = Field(default_factory=list)
