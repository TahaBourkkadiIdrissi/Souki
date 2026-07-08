from typing import Optional

from config import LocalSession
from sqlalchemy.exc import IntegrityError
from dto.panier_dto import (
    ManualBasketRequestDTO,
    ManualBasketResponseDTO,
    PanierDetailsDTO,
    LignePanierResponseDTO,
)
from interfaces.panier_service_interface import IPanierService
from interfaces.panier_dao_interface import IPanierDao
from sqlalchemy.orm import Session

SEUIL_LIVRAISON_GRATUITE = 300.0
DELIVERY_FEE = 15.0

# ── Mapping des images pour les produits ──────────────────────────────────────
PRODUCT_IMAGES = {
    "tomate": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&h=300&fit=crop",
    "oignon": "https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?w=400&h=300&fit=crop",
    "carotte": "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&h=300&fit=crop",
    "pommes de terre": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&h=300&fit=crop",
    "pomme de terre": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&h=300&fit=crop",
    "patate": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&h=300&fit=crop",
    "pomme": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&h=300&fit=crop",
    "concombre": "https://images.unsplash.com/photo-1590769033100-9f41a9bf3b94?w=400&h=300&fit=crop",
    "courgette": "https://images.unsplash.com/photo-1585070526059-c037fcd83b40?w=400&h=300&fit=crop",
    "poivron": "https://images.unsplash.com/photo-1599599810694-c6dc64f74f6f?w=400&h=300&fit=crop",
    "salade": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=300&fit=crop",
    "champignon": "https://images.unsplash.com/photo-1535307671071-a01fb1d1a0b1?w=400&h=300&fit=crop",
    "ail": "https://images.unsplash.com/photo-1599599810964-93b37bf76eb3?w=400&h=300&fit=crop",
    "oeufs": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=300&fit=crop",
    "lait": "https://images.unsplash.com/photo-1599599810964-93b37bf76eb3?w=400&h=300&fit=crop",
    "fromage": "https://images.unsplash.com/photo-1535035307566-a13e2b0e7a4b?w=400&h=300&fit=crop",
}


def get_product_image(product_name: str) -> str:
    """Récupère l'image appropriée pour un produit selon son nom"""
    product_lower = product_name.lower()
    
    # Cherche une correspondance avec les clés du mapping
    for key, url in PRODUCT_IMAGES.items():
        if key in product_lower:
            return url
    
    # Image par défaut si pas de correspondance
    return "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop"


class PanierService(IPanierService):
    """Service pour la gestion du panier"""

    def __init__(self, panier_dao: IPanierDao) -> None:
        self.panier_dao = panier_dao
        self.session = None
        self._owns_session = False

    # ── Context manager ───────────────────────────────────────────────────────
    def __enter__(self):
        self.session = LocalSession()
        self._owns_session = True
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            if exc_type is not None:
                self.session.rollback()
            else:
                self.session.commit()
            self.session.close()
            self.session = None

    def _ensure_session(self) -> Session:
        """S'assure qu'une session est disponible"""
        if self.session is None:
            self.session = LocalSession()
            self._owns_session = True
        return self.session

    # ── Méthodes publiques ────────────────────────────────────────────────────
    def create_manual_basket(
        self, user_id: int, payload: ManualBasketRequestDTO
    ) -> ManualBasketResponseDTO:
        """
        Crée un panier brouillon à partir d'items manuels.
        Valide les stocks et crée les lignes du panier.
        """
        if not payload.items:
            raise ValueError("Le panier ne peut pas être vide.")

        session = self._ensure_session()

        try:
            # Récupérer tous les produits demandés
            product_ids = [item.product_id for item in payload.items]
            products = self.panier_dao.get_products_by_ids(session, product_ids)
            products_by_id = {int(product.id): product for product in products} # type: ignore

            # Vérifier que tous les produits existent
            if len(products_by_id) != len(set(product_ids)):
                raise ValueError("Un ou plusieurs produits du panier sont introuvables.")

            # Valider les stocks et calculer les totaux
            total_articles = 0
            total_legumes = 0.0
            sous_total = 0.0
            lignes_response = []

            for item in payload.items:
                if item.quantity <= 0:
                    raise ValueError("Chaque ligne du panier doit avoir une quantité positive.")

                product = products_by_id[item.product_id]
                requested_quantity = float(item.quantity)
                available_stock = float(product.stock) # type: ignore
                prix_affiche = getattr(product, "prix_affiche", None)
                unit_price = (
                    float(prix_affiche)
                    if prix_affiche is not None
                    else float(product.prix_kg) # type: ignore
                )

                if available_stock < requested_quantity:
                    raise ValueError(
                        f"Stock insuffisant pour {product.nom_fr}. "
                        f"Disponible: {available_stock} {product.unite}."
                    )

                line_total = round(unit_price * requested_quantity, 2)
                sous_total += line_total
                total_legumes += requested_quantity
                total_articles += 1

                lignes_response.append(
                    LignePanierResponseDTO(
                        product_id=int(product.id), # type: ignore
                        nom_produit=str(product.nom_fr),
                        quantite_kg=requested_quantity,
                        prix_unitaire=unit_price,
                        sous_total=line_total,
                        unite=str(product.unite),
                        image=get_product_image(str(product.nom_fr)),
                    )
                )

            # Créer le panier brouillon
            frais_livraison = 0.0 if sous_total >= SEUIL_LIVRAISON_GRATUITE else DELIVERY_FEE
            montant_total = round(sous_total + frais_livraison, 2)
            panier = self.panier_dao.create_panier_draft(
                session=session,
                user_id=user_id,
                total_legumes=round(total_legumes, 2),
                total_facture=montant_total,
            )

            # Essaye de créer une commande brouillon liée au panier.
            # Si la base refuse le statut "brouillon" (contrainte CHECK),
            # on conserve quand même le panier pour permettre le checkout final.
            try:
                with session.begin_nested():
                    self.panier_dao.create_commande_draft(
                        session=session,
                        client_id=user_id,
                        panier_id=int(panier.id), # type: ignore
                        montant_total=montant_total
                    )
            except IntegrityError:
                pass

            # Créer les lignes du panier
            for i, item in enumerate(payload.items):
                product = products_by_id[item.product_id]
                prix_affiche = getattr(product, "prix_affiche", None)
                unit_price = (
                    float(prix_affiche)
                    if prix_affiche is not None
                    else float(product.prix_kg) # type: ignore
                )
                line_total = round(unit_price * float(item.quantity), 2)
                self.panier_dao.create_ligne_panier(
                    session=session,
                    panier_id=int(panier.id), # type: ignore
                    produit_id=item.product_id,
                    quantite_kg=float(item.quantity),
                    sous_total=line_total,
                )

            return ManualBasketResponseDTO(
                status="success",
                panier_id=int(panier.id), # type: ignore
                lignes_panier=lignes_response,
                total_dh=round(sous_total, 2),
                nombre_articles=total_articles,
                frais_livraison=frais_livraison,
            )

        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"Erreur lors de la création du panier: {str(e)}")

    def get_panier_details(self, panier_id: int, user_id: int) -> PanierDetailsDTO:
        """Récupère les détails complets d'un panier pour affichage.

        Le panier n'est retourné que s'il appartient à `user_id` (anti-IDOR) :
        le panier d'un autre utilisateur est traité comme introuvable.
        """
        session = self._ensure_session()

        panier = self.panier_dao.get_panier_by_id(session, panier_id, user_id)
        if not panier:
            raise ValueError(f"Panier {panier_id} non trouvé.")

        lignes = self.panier_dao.get_lignes_panier(session, panier_id)

        lignes_response = []
        for ligne in lignes:
            product = self.panier_dao.get_product_by_id(session, ligne.produit_id) # type: ignore
            if product:
                quantite_kg = float(ligne.quantite_kg) # type: ignore
                sous_total_ligne = float(ligne.sous_total) # type: ignore
                prix_unitaire = (
                    round(sous_total_ligne / quantite_kg, 2)
                    if quantite_kg > 0
                    else float(product.prix_kg) # type: ignore
                )
                lignes_response.append(
                    LignePanierResponseDTO(
                        product_id=int(ligne.produit_id), # type: ignore
                        nom_produit=str(product.nom_fr),
                        quantite_kg=quantite_kg,
                        prix_unitaire=prix_unitaire,
                        sous_total=sous_total_ligne,
                        unite=str(product.unite),
                        image=get_product_image(str(product.nom_fr)),
                    )
                )

        total_legumes = float(panier.total_legumes) # type: ignore
        montant_total = float(panier.total_facture) # type: ignore
        sous_total = round(
            sum(float(ligne.sous_total) for ligne in lignes), # type: ignore
            2,
        )
        frais_livraison = round(max(0.0, montant_total - sous_total), 2)

        return PanierDetailsDTO(
            panier_id=int(panier.id), # type: ignore
            lignes=lignes_response,
            total_legumes=total_legumes,
            sous_total=round(sous_total, 2),
            frais_livraison=frais_livraison,
            montant_total=montant_total,
        )
