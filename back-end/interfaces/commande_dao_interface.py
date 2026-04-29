from abc import ABC, abstractmethod
from typing import List, Optional

from sqlalchemy.orm import Session

from dto.commande_dto import CommandeHistoriqueDTO, CommandeJourDTO, FicheClientDTO
from entities.commande_entity import Commande
from entities.commande_vocale_entity import CommandeVocale


class ICommandeVocaleDao(ABC):

    @abstractmethod
    def create_commande(
        self, session: Session, user_id: int, transcription: str, json_brut: str, langue: str
    ) -> Optional[CommandeVocale]:
        """Cree une commande vocale en BDD."""
        pass

    @abstractmethod
    def create_ligne(
        self, session: Session, commande_id: int, product_id: int,
        qte_demandee: float, qte_effective: float, prix: float,
        sous_total: float, message: Optional[str]
    ) -> bool:
        """Cree une ligne de commande vocale. Retourne True si succes."""
        pass

    @abstractmethod
    def get_details_for_checkout(self, session: Session, commande_id: int) -> Optional[dict]:
        """Recupere les donnees formatees pour le checkout."""
        pass

    @abstractmethod
    def get_commandes_du_jour(self, session: Session) -> List[CommandeJourDTO]:
        """Retourne toutes les commandes du jour."""
        pass

    @abstractmethod
    def get_historique_client(self, session: Session, client_id: int) -> List[CommandeHistoriqueDTO]:
        """Retourne l'historique des commandes validees du client connecte."""
        pass

    @abstractmethod
    def get_fiche_client(self, session: Session, client_id: int) -> Optional[FicheClientDTO]:
        """Retourne la fiche complete d'un client."""
        pass

    @abstractmethod
    def get_commande_for_claim(
        self,
        session: Session,
        *,
        user_id: int,
        commande_id: int,
        for_update: bool = False,
    ) -> Optional[Commande]:
        """Retourne une commande finale du client avec son panier pour traitement SAV."""
        pass
