from abc import ABC, abstractmethod
from typing import List
from config import LocalSession
from dto import ProductResponseDTO
from interfaces import IProductDao


class ICatalogueService(ABC):
    @abstractmethod
    def get_catalogue_complet(self) -> List[ProductResponseDTO]:
        """Récupère le catalogue complet des produits"""
        pass


class CatalogueService(ICatalogueService):
    def __init__(self, product_dao: IProductDao, session=None) -> None:
        self.product_dao = product_dao
        self.session = session

    def __enter__(self):
        if self.session is None:
            self.session = LocalSession()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            if exc_type is not None:
                self.session.rollback()
            self.session.close()

    def get_catalogue_complet(self) -> List[ProductResponseDTO]:
        if not self.session:
            self.session = LocalSession()

        try:
            products = self.product_dao.get_all(self.session)
            return [
                ProductResponseDTO(
                    id=p.id, # type: ignore
                    nom_fr=p.nom_fr, # type: ignore
                    nom_darija=p.nom_darija, # type: ignore
                    prix_kg=p.prix_kg, # type: ignore
                    unite=p.unite, # type: ignore
                    stock=p.stock # type: ignore
                )
                for p in products
            ]
        finally:
            if not hasattr(self, '_in_context'):
                self.session.close()
