from abc import ABC, abstractmethod
from datetime import date
from typing import Any


class IDispatchService(ABC):

    @abstractmethod
    def __enter__(self):
        pass

    @abstractmethod
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    @abstractmethod
    def generate_daily_routes(self, target_date: date) -> dict[str, Any]:
        pass

    @abstractmethod
    def get_tournees_details(self, target_date: date) -> dict[str, Any]:
        pass

    @abstractmethod
    def resolve_anomalie_replanifier(self, anomalie_id: int, admin_id: int) -> dict[str, Any]:
        pass

    @abstractmethod
    def resolve_anomalie_annuler(self, anomalie_id: int, admin_id: int) -> dict[str, Any]:
        pass

    @abstractmethod
    def reassign_commande(self, commande_id: int, nouvelle_tournee_id: int) -> dict[str, Any]:
        pass
