from pydantic import BaseModel
from typing import Optional, List


class TextBasketRequest(BaseModel):
    texte: str


class LigneCommandeDTO(BaseModel):
    product_id: int
    nom_produit: str
    quantite_demandee: float
    quantite_effective: float
    prix_unitaire: float
    sous_total: float
    message_ajustement: Optional[str] = None


class VoiceBasketResponseDTO(BaseModel):
    status: str
    transcription: Optional[str] = None
    langue_detectee: Optional[str] = None
    produits_non_disponibles: List[str] = []
    lignes_panier: List[LigneCommandeDTO] = []
    total_dh: float = 0.0
    nombre_articles: int = 0
    commande_id: Optional[int] = None

class LigneCheckoutDTO(BaseModel):
    product_id: int
    nom_produit: str
    quantite_effective: float
    prix_unitaire: float
    sous_total: float
    unite: str
    image: str = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop"

class CommandeCheckoutDTO(BaseModel):
    commande_id: int
    transcription: Optional[str] = None
    lignes: List[LigneCheckoutDTO]
    total_dh: float