from typing import Dict, List, Set

from sqlalchemy import func
from sqlalchemy.orm import Session

from entities.commande_entity import Commande
from entities.ligne_panier_entity import LignePanier
from entities.product_entity import Product
from entities.user_favorite_entity import UserFavorite


class FavoriteDaoBD:
    """Acces donnees des favoris utilisateur + signal d'achats (pour la reco)."""

    def get_favorite_ids(self, session: Session, user_id: int) -> Set[int]:
        rows = (
            session.query(UserFavorite.produit_id)
            .filter(UserFavorite.user_id == user_id)
            .all()
        )
        return {int(row[0]) for row in rows}

    def list_favorite_products(self, session: Session, user_id: int) -> List[Product]:
        """Produits favoris actifs, du plus recemment ajoute au plus ancien."""
        return (
            session.query(Product)
            .join(UserFavorite, UserFavorite.produit_id == Product.id)
            .filter(UserFavorite.user_id == user_id)
            .filter(Product.is_active == True)  # noqa: E712
            .order_by(UserFavorite.created_at.desc())
            .all()
        )

    def add_favorite(self, session: Session, user_id: int, produit_id: int) -> bool:
        """Ajoute un favori (idempotent). Retourne True si cree, False si deja present."""
        exists = (
            session.query(UserFavorite.id)
            .filter(
                UserFavorite.user_id == user_id,
                UserFavorite.produit_id == produit_id,
            )
            .first()
        )
        if exists:
            return False
        session.add(UserFavorite(user_id=user_id, produit_id=produit_id))
        session.flush()
        return True

    def remove_favorite(self, session: Session, user_id: int, produit_id: int) -> bool:
        deleted = (
            session.query(UserFavorite)
            .filter(
                UserFavorite.user_id == user_id,
                UserFavorite.produit_id == produit_id,
            )
            .delete(synchronize_session=False)
        )
        session.flush()
        return deleted > 0

    def get_ordered_product_frequency(self, session: Session, user_id: int) -> Dict[int, int]:
        """Frequence d'achat par produit pour cet utilisateur.

        Signal pour les suggestions personnalisees : t_commandes -> t_lignes_panier
        via panier_id. Plus un produit a ete commande, plus il est mis en avant.
        """
        rows = (
            session.query(LignePanier.produit_id, func.count().label("freq"))
            .join(Commande, Commande.panier_id == LignePanier.panier_id)
            .filter(Commande.client_id == user_id)
            .filter(LignePanier.produit_id.isnot(None))
            .group_by(LignePanier.produit_id)
            .all()
        )
        return {int(produit_id): int(freq) for produit_id, freq in rows}
