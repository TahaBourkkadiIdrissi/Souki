from abc import ABC, abstractmethod
from typing import Optional
from sqlalchemy.orm import Session


class IPanierDao(ABC):
    """Interface pour l'accès aux données du panier"""

    @abstractmethod
    def create_panier_draft(
        self,
        session: Session,
        user_id: int,
        total_legumes: float,
        total_facture: float,
    ) -> any:
        """Crée un panier brouillon"""
        pass

    @abstractmethod
    def create_commande_draft(
        self,
        session: Session,
        client_id: int,
        panier_id: int,
        montant_total: float,
    ) -> any:
        """Crée une commande brouillon liée à un panier manuel"""
        pass

    @abstractmethod
    def create_ligne_panier(
        self,
        session: Session,
        panier_id: int,
        produit_id: int,
        quantite_kg: float,
        sous_total: float,
    ) -> any:
        """Crée une ligne du panier"""
        pass

    @abstractmethod
    def get_panier_by_id(self, session: Session, panier_id: int) -> Optional[any]:
        """Récupère un panier par ID"""
        pass

    @abstractmethod
    def get_lignes_panier(self, session: Session, panier_id: int) -> list:
        """Récupère toutes les lignes d'un panier"""
        pass
