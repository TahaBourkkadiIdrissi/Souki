from abc import ABC, abstractmethod

from dto.commande_dto import VoiceBasketResponseDTO, CommandeCheckoutDTO



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
    def traiter_texte(self, texte: str) -> VoiceBasketResponseDTO:
        """Traite une commande sous forme de texte."""
        pass

    @abstractmethod
    def traiter_audio(self, audio_b64: str, mime_type: str) -> VoiceBasketResponseDTO:
        """Traite une commande sous forme d'audio encode en base64."""
        pass

    @abstractmethod
    def get_commande_checkout(self, commande_id: int) -> Optional[CommandeCheckoutDTO]:
        """Récupère le détail d'une commande pour le checkout."""
        pass
