from abc import ABC, abstractmethod
from typing import Optional

from sqlalchemy.orm import Session

from dto.dashboard_dto import DashboardDTO


class IDashboardService(ABC):

    @abstractmethod
    def get_dashboard(
        self,
        session: Session,
        periode: str,
        date_custom: Optional[str] = None,
    ) -> DashboardDTO:
        pass
