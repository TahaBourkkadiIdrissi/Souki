from abc import ABC, abstractmethod
from sqlalchemy.orm import Session
from typing import Any, Optional, List
from dto.commande_dto import CommandeJourDTO, FicheClientDTO
from entities.commande_entity import Commande
from entities.commande_vocale_entity import CommandeVocale


class ICommandeVocaleDao(ABC):

    @abstractmethod
    def create_commande(
        self, session: Session, user_id: int, transcription: str, json_brut: str, langue: str
    ) -> Optional[CommandeVocale]:
        """Crée une commande vocale en BDD."""
        pass

    @abstractmethod
    def create_ligne(
        self, session: Session, commande_id: int, product_id: int,
        qte_demandee: float, qte_effective: float, prix: float,
        sous_total: float, message: Optional[str]
    ) -> bool:
        """Crée une ligne de commande vocale. Retourne True si succès."""
        pass
    
    @abstractmethod
    def get_details_for_checkout(self, session: Session, commande_id: int) -> Optional[dict]:
        """Récupère les données formatées pour le checkout."""
        pass

    @abstractmethod
    def get_commandes_du_jour(self, session: Session) -> List[CommandeJourDTO]:
        """Retourne toutes les commandes du jour"""
        pass

    @abstractmethod
    def get_historique_client(self, session: Session, client_id: int) -> List[CommandeHistoriqueDTO]:
        """Retourne l'historique des commandes validees du client connecte"""
        pass

    @abstractmethod
    def get_fiche_client(self, session: Session, client_id: int) -> Optional[FicheClientDTO]:
        """Retourne la fiche complète d'un client"""
        pass

    @abstractmethod
    def get_commandes_cod_verrouillees(self, session: Session) -> List[dict[str, Any]]:
        """Retourne les commandes COD verrouillees par le JIT."""
        pass

    @abstractmethod
    def get_commande_for_cod_update(self, session: Session, commande_id: int) -> Optional[Commande]:
        """Retourne une commande pour l'action de confirmation COD."""
        pass

    @abstractmethod
    def annuler_commande_cod(self, session: Session, commande: Commande) -> None:
        """Annule une commande COD et la retire de la tournee."""
        pass
