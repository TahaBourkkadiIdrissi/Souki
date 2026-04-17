from abc import ABC, abstractmethod
from dto.commande_dto import VoiceBasketResponseDTO


class ICommandeVocaleService(ABC):

    @abstractmethod
    def traiter_texte(self, texte: str) -> VoiceBasketResponseDTO:
        """Traite une commande sous forme de texte."""
        pass

    @abstractmethod
    def traiter_audio(self, audio_b64: str, mime_type: str) -> VoiceBasketResponseDTO:
        """Traite une commande sous forme d'audio encodé en base64."""
        pass
