from typing import List

from config import LocalSession
from dao.favorite_dao import FavoriteDaoBD
from dao.product_dao import ProductDaoBD
from dto.product_dto import ProductResponseDTO
from entities.product_entity import Product
from services.catalogue_service import CatalogueService


class FavoriteService:
    """Logique metier des favoris utilisateur.

    Gere son propre cycle de session (comme ProfileService/SoukiWalletService).
    La conversion en ProductResponseDTO reutilise CatalogueService pour rester
    coherente avec le catalogue (prix_khddar_estime, prix_affiche...).
    """

    def __init__(self) -> None:
        self.favorite_dao = FavoriteDaoBD()
        self.product_dao = ProductDaoBD()

    def list_favorites(self, user_id: int) -> List[ProductResponseDTO]:
        session = LocalSession()
        try:
            products = self.favorite_dao.list_favorite_products(session, user_id)
            catalogue = CatalogueService(self.product_dao, session)
            return [catalogue._to_product_response(p) for p in products]
        finally:
            session.close()

    def add_favorite(self, user_id: int, produit_id: int) -> bool:
        """Ajoute un favori. Leve ValueError si le produit n'existe pas / inactif."""
        session = LocalSession()
        try:
            product = (
                session.query(Product)
                .filter(Product.id == produit_id, Product.is_active == True)  # noqa: E712
                .first()
            )
            if product is None:
                raise ValueError("Produit introuvable")
            created = self.favorite_dao.add_favorite(session, user_id, produit_id)
            session.commit()
            return created
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def remove_favorite(self, user_id: int, produit_id: int) -> bool:
        session = LocalSession()
        try:
            removed = self.favorite_dao.remove_favorite(session, user_id, produit_id)
            session.commit()
            return removed
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
