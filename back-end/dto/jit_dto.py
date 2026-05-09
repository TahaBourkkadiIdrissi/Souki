from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class DetailProduitJIT(BaseModel):
    """Détail d'un produit dans l'agrégation JIT"""
    product_id: int
    nom_fr: str
    nom_darija: str
    quantite_brute_kg: float  # Vol brut des commandes
    buffer_perte_10_pct: float  # Buffer 10%
    volume_total_kg: float  # Arrondi à la caisse entière supérieure
    prix_kg: float
    prix_achat: float
    sous_total: float
    sous_total_ca: float
    sous_total_achat: float
    unite: str

    class Config:
        from_attributes = True


class ResultatAgregationJIT(BaseModel):
    """Résultat de l'agrégation JIT"""
    nombre_commandes: int
    nombre_abonnements: int
    volume_total_kg: float
    details_produits: List[DetailProduitJIT]
    montant_total: float
    ca_estime_total: float
    cout_achat_estime: float
    marge_estimee: float
    statut: str  # "succès", "aucune_commande", "erreur"
    message: Optional[str] = None

    class Config:
        from_attributes = True


class JITLogDTO(BaseModel):
    """DTO pour le JIT Log stocké en BDD"""
    id: Optional[int] = None
    date_execution: Optional[str] = None
    volume_total: float
    nombre_commandes: int
    nombre_abonnements: int
    statut: str
    details_volumes: Optional[Dict[str, Any]] = None
    message_alerte: Optional[str] = None

    class Config:
        from_attributes = True
