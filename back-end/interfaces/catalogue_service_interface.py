from abc import ABC, abstractmethod
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from dto.commande_dto import LigneCommandeDTO
from dto.product_dto import ProductResponseDTO


class ICatalogueService(ABC):

    @abstractmethod
    def __enter__(self):
        """Ouvre le contexte du service et retourne l'instance."""
        pass

    @abstractmethod
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Ferme proprement les ressources du service."""
        pass

    @abstractmethod
    def get_catalogue_complet(self) -> List[ProductResponseDTO]:
        """Retourne la liste complete des produits disponibles."""
        pass

    @abstractmethod
    def get_suggestions(
        self,
        session: Session,
        exclude_ids: list[int],
    ) -> List[ProductResponseDTO]:
        """Retourne les suggestions publiques du catalogue."""
        pass

    @abstractmethod
    def valider_et_ajuster_item(
        self, item_gemini: dict
    ) -> Tuple[Optional[LigneCommandeDTO], Optional[str]]:
        """Valide un item de commande et ajuste sa quantite selon le stock."""
        pass
