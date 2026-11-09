"""« Recommander » : les produits d'une commande passee, aux prix et a la disponibilite du jour."""

from typing import Optional

from pydantic import BaseModel


class ReorderLineDTO(BaseModel):
    product_id: int
    nom_fr: str
    nom_ar: Optional[str] = None
    unite: str
    image_url: Optional[str] = None
    # Quantite de la commande d'origine (l'app l'arrondit au pas du produit).
    quantite: float
    # Prix du jour : prix_affiche, sinon prix_kg (meme regle que le catalogue public).
    prix_unitaire: Optional[float] = None
    sous_total: Optional[float] = None
    disponible: bool
    # Raison affichee quand le produit ne peut pas etre repris.
    raison: Optional[str] = None


class ReorderResponseDTO(BaseModel):
    commande_id: int
    lignes: list[ReorderLineDTO]
    # Total des seules lignes disponibles, aux prix du jour, hors livraison.
    total_dh: float
    nombre_disponibles: int
