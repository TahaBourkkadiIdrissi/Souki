from abc import ABC, abstractmethod
from datetime import date, datetime

from sqlalchemy.orm import Session

from dto.dashboard_dto import DashboardDTO


class IDashboardDao(ABC):

    @abstractmethod
    def get_dashboard(
        self,
        session: Session,
        *,
        start_datetime: datetime,
        end_datetime: datetime,
        today: date,
        curve_start_datetime: datetime,
        curve_end_datetime: datetime,
    ) -> DashboardDTO:
        pass
