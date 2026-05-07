from abc import ABC, abstractmethod

from sqlalchemy.orm import Session

from dto.dashboard_dto import DashboardDTO


class IDashboardService(ABC):

    @abstractmethod
    def get_dashboard(self, session: Session, periode: str) -> DashboardDTO:
        pass
