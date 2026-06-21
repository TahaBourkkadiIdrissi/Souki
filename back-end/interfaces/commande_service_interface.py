from abc import ABC, abstractmethod
from typing import Optional, List
from sqlalchemy.orm import Session

from dto.commande_dto import VoiceBasketResponseDTO, CommandeCheckoutDTO, CommandeHistoriqueDTO, CommandeJourDTO, FicheClientDTO



class ICommandeVocaleService(ABC):

    @abstractmethod
    def __enter__(self):
        """Ouvre le contexte du service et retourne l'instance."""
        pass

    @abstractmethod
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Ferme proprement les ressources du service."""
        pass

    @abstractmethod
    def traiter_texte(self, user_id: int, texte: str) -> VoiceBasketResponseDTO:
        """Traite une commande sous forme de texte."""
        pass

    @abstractmethod
    def traiter_audio(self, user_id: int, audio_b64: str, mime_type: str) -> VoiceBasketResponseDTO:
        """Traite une commande sous forme d'audio encode en base64."""
        pass

    @abstractmethod
    def get_commande_checkout(self, commande_id: int) -> Optional[CommandeCheckoutDTO]:
        """Récupère le détail d'une commande pour le checkout."""
        pass

    @abstractmethod
    def get_commandes_du_jour(self, session: Session) -> List[CommandeJourDTO]:
        """Retourne toutes les commandes du jour"""
        pass

    @abstractmethod
    def get_historique_client(self, client_id: int) -> List[CommandeHistoriqueDTO]:
        """Retourne l'historique des commandes du client connecte"""
        pass

    @abstractmethod
    def delete_historique_commande(self, client_id: int, commande_id: int) -> bool:
        """Masque une commande de l'historique du client connecte"""
        pass

    @abstractmethod
    def get_fiche_client(self, session: Session, client_id: int) -> Optional[FicheClientDTO]:
        """Retourne la fiche complète d'un client"""
        pass
