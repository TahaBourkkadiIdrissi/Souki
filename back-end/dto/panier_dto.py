from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ManualBasketItemDTO(BaseModel):
    """Item du panier manuel"""
    product_id: int
    quantity: float  # en kg
    prix_unitaire: Optional[float] = None


class ManualBasketRequestDTO(BaseModel):
    """Requête pour créer un panier brouillon manuel"""
    items: List[ManualBasketItemDTO]


class LignePanierResponseDTO(BaseModel):
    """Ligne du panier pour réponse"""
    product_id: int
    nom_produit: str
    quantite_kg: float
    prix_unitaire: float
    sous_total: float
    unite: str
    image: str = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop"


class ManualBasketResponseDTO(BaseModel):
    """Réponse pour un panier manuel validé"""
    status: str
    panier_id: int
    lignes_panier: List[LignePanierResponseDTO] = []
    total_dh: float = 0.0
    nombre_articles: int = 0
    frais_livraison: float = 10.0


class PanierDetailsDTO(BaseModel):
    """Détails complets d'un panier pour affichage avant checkout"""
    panier_id: int
    lignes: List[LignePanierResponseDTO]
    total_legumes: float
    sous_total: float
    frais_livraison: float = 10.0
    montant_total: float


ProfilPanier = Literal[
    "aromates_herbes",
    "cuisine_couscous",
    "cuisine_tajine",
    "equilibre",
    "fruits_dominant",
    "legumes_base",
    "legumes_verts",
    "racines_tubercules",
    "salade_fraicheur",
    "soupe_hiver",
]


class PanierRequestDTO(BaseModel):
    """Criteres stricts pour generer un panier intelligent."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    budget: float = Field(gt=0, le=5000)
    personnes: int = Field(ge=1, le=8)
    duree: int = Field(alias="durée", ge=3, le=14)
    profil: ProfilPanier = "equilibre"


class PanierResponseDTO(BaseModel):
    """Reponse du modele ML pour le panier intelligent."""

    status: str
    source: str
    panier_id: Optional[int] = None
    criteres: Dict[str, object]
    lignes_panier: List[LignePanierResponseDTO] = Field(default_factory=list)
    total_dh: float = 0.0
    nombre_articles: int = 0
    model_warning: Optional[str] = None
