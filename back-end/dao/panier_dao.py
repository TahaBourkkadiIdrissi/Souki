from typing import Optional, List
from sqlalchemy.orm import Session

from entities.panier_entity import Panier
from entities.ligne_panier_entity import LignePanier
from entities.commande_entity import Commande
from entities.client_entity import Client
from entities.product_entity import Product
from interfaces.panier_dao_interface import IPanierDao


class PanierDaoBD(IPanierDao):
    """DAO pour la gestion des paniers en base de données"""

    def create_panier_draft(
        self,
        session: Session,
        user_id: int,
        total_legumes: float,
        total_facture: float,
    ) -> Panier:
        """Crée un panier brouillon (draft) pour l'utilisateur"""
        panier = Panier(
            user_id=user_id,
            total_legumes=total_legumes,
            total_facture=total_facture,
            marge_brute=0.0,  # Pas de marge pour panier draft
        )
        session.add(panier)
        session.flush()
        return panier

    def create_commande_draft(
        self,
        session: Session,
        client_id: int,
        panier_id: int,
        montant_total: float,
    ) -> Commande:
        """Crée une commande brouillon liée à un panier"""
        client = session.query(Client).filter(Client.user_id == client_id).first()
        if not client:
            client = Client(user_id=client_id)
            session.add(client)
            session.flush()

        commande = Commande(
            client_id=client_id,
            panier_id=panier_id,
            statut="BROUILLON",
            montant_total=montant_total
        )
        session.add(commande)
        session.flush()
        return commande

    def create_ligne_panier(
        self,
        session: Session,
        panier_id: int,
        produit_id: int,
        quantite_kg: float,
        sous_total: float,
    ) -> LignePanier:
        """Crée une ligne du panier"""
        ligne = LignePanier(
            panier_id=panier_id,
            produit_id=produit_id,
            quantite_kg=quantite_kg,
            sous_total=sous_total,
        )
        session.add(ligne)
        session.flush()
        return ligne

    def get_panier_by_id(self, session: Session, panier_id: int) -> Optional[Panier]:
        """Récupère un panier par son ID"""
        return session.query(Panier).filter(Panier.id == panier_id).first()

    def get_lignes_panier(self, session: Session, panier_id: int) -> List[LignePanier]:
        """Récupère toutes les lignes d'un panier"""
        return (
            session.query(LignePanier)
            .filter(LignePanier.panier_id == panier_id)
            .all()
        )

    def get_product_by_id(self, session: Session, product_id: int) -> Optional[Product]:
        """Récupère un produit par son ID"""
        return session.query(Product).filter(Product.id == product_id).first()

    def get_products_by_ids(self, session: Session, product_ids: List[int]) -> List[Product]:
        """Récupère plusieurs produits par leurs IDs"""
        return (
            session.query(Product)
            .filter(Product.id.in_(product_ids))
            .order_by(Product.id.asc())
            .all()
        )

    def get_active_products_for_ml(self, session: Session) -> List[Product]:
        """Recupere les produits actifs/en stock pour la generation ML."""
        return (
            session.query(Product)
            .filter(Product.is_active == True)  # noqa: E712
            .filter(Product.stock > 0)
            .order_by(Product.id.asc())
            .all()
        )

    def decrement_stock(self, session: Session, product_id: int, quantity: float) -> None:
        """Réduit le stock d'un produit"""
        product = self.get_product_by_id(session, product_id)
        if product:
            product.stock = float(product.stock) - quantity # type: ignore
