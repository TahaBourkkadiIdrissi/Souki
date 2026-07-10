from abc import ABC, abstractmethod
from dto.panier_dto import ManualBasketRequestDTO, ManualBasketResponseDTO, PanierDetailsDTO


class IPanierService(ABC):
    """Interface pour la gestion du panier"""

    @abstractmethod
    def create_manual_basket(self, user_id: int, payload: ManualBasketRequestDTO) -> ManualBasketResponseDTO:
        """
        Crée un panier brouillon à partir d'items manuels.
        
        Args:
            user_id: ID de l'utilisateur
            payload: Items du panier à créer
            
        Returns:
            ManualBasketResponseDTO avec détails du panier créé
            
        Raises:
            ValueError: Si validations échouent
        """
        pass

    @abstractmethod
    def get_panier_details(self, panier_id: int, user_id: int) -> PanierDetailsDTO:
        """
        Récupère les détails complets d'un panier appartenant à l'utilisateur.

        Args:
            panier_id: ID du panier
            user_id: ID du propriétaire attendu (anti-IDOR)

        Returns:
            PanierDetailsDTO avec toutes les lignes

        Raises:
            ValueError: Si le panier n'existe pas ou n'appartient pas à l'utilisateur
        """
        pass
