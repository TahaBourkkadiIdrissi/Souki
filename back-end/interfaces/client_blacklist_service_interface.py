from abc import ABC, abstractmethod
from typing import List, Optional

from sqlalchemy.orm import Session

from dto.client_blacklist_dto import ClientBlacklistDTO, BlacklistReportDTO


class IClientBlacklistService(ABC):

    @abstractmethod
    def blacklist_after_refusal(
        self,
        session: Session,
        client_id: int,
        commande_id: int,
        livreur_id: int,
    ) -> None:
        """Blackliste automatiquement après refus livreur"""
        pass

    @abstractmethod
    def blacklist_manual(
        self,
        session: Session,
        client_id: int,
        admin_id: int,
        reason: str,
    ) -> None:
        """Blackliste manuellement depuis le BO"""
        pass

    @abstractmethod
    def lift_blacklist(
        self,
        session: Session,
        client_id: int,
        admin_id: int,
        reason: Optional[str] = None,
    ) -> None:
        """Lève le blacklist manuellement depuis le BO"""
        pass

    @abstractmethod
    def get_blacklisted_clients(
        self, session: Session
    ) -> List[ClientBlacklistDTO]:
        pass

    @abstractmethod
    def get_monthly_report(
        self, session: Session, year: int, month: int
    ) -> BlacklistReportDTO:
        pass
