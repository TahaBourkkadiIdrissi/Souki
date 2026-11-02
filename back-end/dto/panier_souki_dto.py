from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from dto.commande_recurrente_dto import CommandeRecurrenteLigneInDTO


class PanierSoukiLigneDTO(BaseModel):
    product_id: int
    nom_produit: str
    nom_darija: str | None = None
    unite: str
    image_url: str | None = None
    quantite: float
    prix_unitaire: float
    sous_total: float
    disponible: bool = True


class PanierSoukiDTO(BaseModel):
    """Panier propose par SOUKI. Les prix sont ceux du site aujourd'hui : rien n'est fige ni remise."""
    id: int
    nom: str
    description: str | None = None
    image_url: str | None = None
    actif: bool = True
    ordre: int = 0
    lignes: list[PanierSoukiLigneDTO] = Field(default_factory=list)
    sous_total_estime: float = 0.0
    frais_livraison_estimes: float = 0.0
    total_estime: float = 0.0
    created_at: datetime | None = None


class PanierSoukiInDTO(BaseModel):
    nom: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    image_url: str | None = Field(default=None, max_length=500)
    actif: bool = True
    ordre: int = Field(default=0, ge=0, le=1000)
    lignes: list[CommandeRecurrenteLigneInDTO] = Field(min_length=1, max_length=80)

    @field_validator("nom", "description", "image_url", mode="before")
    @classmethod
    def strip_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value
