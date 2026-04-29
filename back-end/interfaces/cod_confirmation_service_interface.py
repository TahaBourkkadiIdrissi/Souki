from abc import ABC, abstractmethod
from typing import List

from dto.commande_dto import CommandeCODDemainDTO, ConfirmationCODResponseDTO


class ICODConfirmationService(ABC):

    @abstractmethod
    def __enter__(self):
        pass

    @abstractmethod
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    @abstractmethod
    def get_commandes_cod_demain(self) -> List[CommandeCODDemainDTO]:
        pass

    @abstractmethod
    def update_confirmation_cod(
        self,
        commande_id: int,
        statut: str,
        admin_id: int,
    ) -> ConfirmationCODResponseDTO:
        pass
