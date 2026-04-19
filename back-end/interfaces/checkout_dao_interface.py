from abc import ABC, abstractmethod
from typing import List, Optional

from sqlalchemy.orm import Session

from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.ligne_panier_entity import LignePanier
from entities.panier_entity import Panier
from entities.product_entity import Product


class ICheckoutDao(ABC):

    @abstractmethod
    def get_products_by_ids(self, session: Session, product_ids: List[int]) -> List[Product]:
        pass

    @abstractmethod
    def get_or_create_client(self, session: Session, user_id: int) -> Client:
        pass

    @abstractmethod
    def create_panier(
        self,
        session: Session,
        user_id: int,
        total_legumes: float,
        total_facture: float,
        marge_brute: float,
    ) -> Panier:
        pass

    @abstractmethod
    def create_ligne_panier(
        self,
        session: Session,
        panier_id: int,
        produit_id: int,
        quantite_kg: float,
        sous_total: float,
    ) -> LignePanier:
        pass

    @abstractmethod
    def create_commande(
        self,
        session: Session,
        client_id: int,
        panier_id: int,
        brouillon_vocal_id: Optional[int],
        statut: str,
        creneau_livraison: str,
        mode_paiement: str,
        montant_total: float,
    ) -> Commande:
        pass
