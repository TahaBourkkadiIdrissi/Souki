from abc import ABC, abstractmethod
from dto import VoiceBasketResponseDTO


class ICommandeVocaleService(ABC):
    @abstractmethod
    def traiter_texte(self, texte: str) -> VoiceBasketResponseDTO:
        """Traite une commande en texte"""
        pass

    @abstractmethod
    def traiter_audio(self, audio_b64: str, mime_type: str) -> VoiceBasketResponseDTO:
        """Traite une commande audio"""
        pass
