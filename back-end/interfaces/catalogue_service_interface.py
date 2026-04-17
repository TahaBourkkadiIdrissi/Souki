from abc import ABC, abstractmethod
from typing import List
from dto.product_dto import ProductResponseDTO


class ICatalogueService(ABC):

    @abstractmethod
    def get_catalogue_complet(self) -> List[ProductResponseDTO]:
        """Retourne la liste complète des produits disponibles."""
        pass
