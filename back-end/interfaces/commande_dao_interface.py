from abc import ABC, abstractmethod
from typing import Any, List, Optional

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
    def hide_commande_from_client_history(self, session: Session, client_id: int, commande_id: int) -> bool:
        """Masque une commande de l'historique du client sans supprimer la commande operationnelle."""
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

    @abstractmethod
    def get_commandes_non_assignees(self, session: Session) -> List[Commande]:
        """Retourne les commandes confirmees non rattachees a une tournee."""
        pass

    @abstractmethod
    def bulk_update_commandes_tournee(self, session: Session, updates: List[dict[str, Any]]) -> None:
        """Assigne plusieurs commandes a des tournees et met a jour leur ordre de passage."""
        pass

    @abstractmethod
    def get_commande_for_reassign(
        self,
        session: Session,
        commande_id: int,
        for_update: bool = False,
    ) -> Optional[Commande]:
        """Retourne une commande pour reassignation logistique."""
        pass

    @abstractmethod
    def reassign_commande_to_tournee(
        self,
        session: Session,
        *,
        commande: Commande,
        tournee_id: int,
        livreur_id: int,
        ordre_passage: int,
    ) -> None:
        """Reassigne une commande a une tournee existante."""
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
