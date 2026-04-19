from abc import ABC, abstractmethod

from dto.livreur_dto import DemarrerTourneeResponseDTO, TourneeResponseDTO


class ILivreurService(ABC):

    @abstractmethod
    def __enter__(self):
        pass

    @abstractmethod
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    @abstractmethod
    def get_tournee(self, livreur_id: int) -> TourneeResponseDTO:
        pass

    @abstractmethod
    def demarrer_tournee(self, livreur_id: int) -> DemarrerTourneeResponseDTO:
        pass
