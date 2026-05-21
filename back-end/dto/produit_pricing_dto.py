from typing import List, Optional

from pydantic import BaseModel


class ProduitPricingDTO(BaseModel):
    id: int
    nom_fr: str
    nom_darija: str
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
    prix_khddar_estime: Optional[float] = None
    alerte: Optional[str] = None


class ProduitPricingUpdateDTO(BaseModel):
    marge_cible: Optional[float] = None
    coussin_securite: Optional[float] = None
    niveau: Optional[int] = None
    volatilite: Optional[str] = None
    prix_gros_saisi: Optional[float] = None
    prix_khddar_reel: Optional[float] = None


class ProductCreateDTO(BaseModel):
    nom_fr: str
    nom_darija: str
    prix_kg: float
    unite: str
    niveau: int = 2
    marge_cible: float = 0.25
    coussin_securite: float = 0.10
    volatilite: str = "STABLE"


class ProductImageDTO(BaseModel):
    image_url: str


class ProduitPricingListDTO(BaseModel):
    items: List[ProduitPricingDTO]
    total: int
    nb_alertes: int
