from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


def _nom_ar_propre(value):
    """Texte arabe vide -> None : le site retombe alors sur le texte francais."""
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class ProduitPricingDTO(BaseModel):
    description: Optional[str] = None
    description_ar: Optional[str] = None
    id: int
    nom_fr: str
    nom_darija: str
    nom_ar: Optional[str] = Field(default=None, max_length=100)
    prix_kg: float
    unite: str
    is_active: bool = True
    image_url: Optional[str] = None
    marge_cible: float = 0.25
    coussin_securite: float = 0.10
    niveau: int = 2
    volatilite: str = "STABLE"
    prix_gros_saisi: Optional[float] = None
    prix_khddar_reel: Optional[float] = None
    prix_affiche: Optional[float] = None
    prix_vente_manuel: Optional[float] = None
    prix_khddar_estime: Optional[float] = None
    alerte: Optional[str] = None


class ProduitPricingUpdateDTO(BaseModel):
    description: Optional[str] = Field(default=None, max_length=5000)
    description_ar: Optional[str] = Field(default=None, max_length=5000)
    nom_ar: Optional[str] = Field(default=None, max_length=100)
    marge_cible: Optional[float] = None
    coussin_securite: Optional[float] = None
    niveau: Optional[int] = None
    volatilite: Optional[str] = None
    prix_gros_saisi: Optional[float] = None
    prix_khddar_reel: Optional[float] = None
    prix_vente_manuel: Optional[float] = None

    _nom_ar = field_validator("nom_ar", "description_ar", mode="before")(_nom_ar_propre)


class ProductCreateDTO(BaseModel):
    description: Optional[str] = Field(default=None, max_length=5000)
    description_ar: Optional[str] = Field(default=None, max_length=5000)
    nom_fr: str
    nom_darija: str
    nom_ar: Optional[str] = Field(default=None, max_length=100)
    prix_kg: float
    unite: str
    niveau: int = 2
    marge_cible: float = 0.25
    coussin_securite: float = 0.10
    volatilite: str = "STABLE"
    prix_gros_saisi: Optional[float] = None
    prix_khddar_reel: Optional[float] = None
    prix_vente_manuel: Optional[float] = None

    _nom_ar = field_validator("nom_ar", "description_ar", mode="before")(_nom_ar_propre)


class ProductImageDTO(BaseModel):
    image_url: str


class ProduitPricingListDTO(BaseModel):
    items: List[ProduitPricingDTO]
    total: int
    nb_alertes: int
