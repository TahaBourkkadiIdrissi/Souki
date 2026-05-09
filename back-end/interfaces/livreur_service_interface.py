from abc import ABC, abstractmethod

from dto.livreur_dto import (
    CodValidationResponseDTO,
    DeliveryEventRequestDTO,
    DeliveryEventResponseDTO,
    DemarrerTourneeResponseDTO,
    LivraisonDecisionRequestDTO,
    TourneeRefusResponseDTO,
    TourneeResponseDTO,
)


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

    @abstractmethod
    def apply_delivery_event(
        self,
        livreur_id: int,
        commande_id: int,
        payload: DeliveryEventRequestDTO,
    ) -> DeliveryEventResponseDTO:
        pass

    @abstractmethod
    def refuser_tournee(
        self,
        livreur_id: int,
        payload: LivraisonDecisionRequestDTO,
    ) -> TourneeRefusResponseDTO:
        pass

    @abstractmethod
    def confirm_cod_payment(
        self,
        livreur_id: int,
        commande_id: int,
    ) -> CodValidationResponseDTO:
        pass
