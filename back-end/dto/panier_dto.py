from pydantic import BaseModel
from typing import List, Optional


class ManualBasketItemDTO(BaseModel):
    """Item du panier manuel"""
    product_id: int
    quantity: float  # en kg


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
