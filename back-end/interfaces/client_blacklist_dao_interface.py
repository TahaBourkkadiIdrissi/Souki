from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from dto.client_blacklist_dto import ClientBlacklistDTO, BlacklistReportDTO


class IClientBlacklistDao(ABC):

    @abstractmethod
    def flush(self, session: Session) -> None:
        pass

    @abstractmethod
    def create_log(
        self,
        session: Session,
        client_id: int,
        action: str,
        source: str,
        phone_snapshot: Optional[str] = None,
        reason: Optional[str] = None,
        commande_id: Optional[int] = None,
        livreur_id: Optional[int] = None,
        admin_id: Optional[int] = None,
    ) -> None:
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

    @abstractmethod
    def get_action_counts_by_period(
        self,
        session: Session,
        start_datetime: datetime,
        end_datetime: datetime,
    ) -> dict[str, int]:
        pass
