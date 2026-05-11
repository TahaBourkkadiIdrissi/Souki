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
        periode: str,
        date_custom: str | None,
        date_debut: datetime,
        date_fin: datetime,
        prec_debut: datetime,
        prec_fin: datetime,
        today: date,
        curve_start_datetime: datetime,
        curve_end_datetime: datetime,
    ) -> DashboardDTO:
        pass
