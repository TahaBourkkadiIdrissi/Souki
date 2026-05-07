from datetime import date, datetime, time, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from dto.dashboard_dto import DashboardDTO
from interfaces.dashboard_dao_interface import IDashboardDao
from interfaces.dashboard_service_interface import IDashboardService


class DashboardService(IDashboardService):

    ALLOWED_PERIODS = {"today", "7d", "30d", "month"}

    def __init__(self, dashboard_dao: IDashboardDao) -> None:
        self.dashboard_dao = dashboard_dao

    def get_dashboard(self, session: Session, periode: str) -> DashboardDTO:
        normalized_period = (periode or "today").strip().lower()
        if normalized_period not in self.ALLOWED_PERIODS:
            raise HTTPException(status_code=400, detail="Periode invalide.")

        today = date.today()
        start_date = self._start_date_for_period(today, normalized_period)
        end_date = today + timedelta(days=1)
        curve_start_date = today - timedelta(days=29)

        return self.dashboard_dao.get_dashboard(
            session,
            start_datetime=datetime.combine(start_date, time.min),
            end_datetime=datetime.combine(end_date, time.min),
            today=today,
            curve_start_datetime=datetime.combine(curve_start_date, time.min),
            curve_end_datetime=datetime.combine(end_date, time.min),
        )

    def _start_date_for_period(self, today: date, periode: str) -> date:
        if periode == "7d":
            return today - timedelta(days=6)
        if periode == "30d":
            return today - timedelta(days=29)
        if periode == "month":
            return today.replace(day=1)
        return today
