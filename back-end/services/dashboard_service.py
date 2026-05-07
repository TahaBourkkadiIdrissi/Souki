from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from dto.dashboard_dto import DashboardDTO
from interfaces.dashboard_dao_interface import IDashboardDao
from interfaces.dashboard_service_interface import IDashboardService


class DashboardService(IDashboardService):

    ALLOWED_PERIODS = {"today", "7d", "30d", "month", "custom"}

    def __init__(self, dashboard_dao: IDashboardDao) -> None:
        self.dashboard_dao = dashboard_dao

    def get_dashboard(
        self,
        session: Session,
        periode: str,
        date_custom: Optional[str] = None,
    ) -> DashboardDTO:
        normalized_period = (periode or "today").strip().lower()
        if normalized_period not in self.ALLOWED_PERIODS:
            raise HTTPException(status_code=400, detail="Periode invalide.")

        today = date.today()
        date_debut, date_fin, prec_debut, prec_fin = self._period_bounds(
            today,
            normalized_period,
            date_custom,
        )
        courbe_debut, courbe_fin = self._curve_bounds(
            normalized_period,
            date_debut,
            date_fin,
        )

        return self.dashboard_dao.get_dashboard(
            session,
            periode=normalized_period,
            date_custom=date_custom if normalized_period == "custom" else None,
            date_debut=date_debut,
            date_fin=date_fin,
            prec_debut=prec_debut,
            prec_fin=prec_fin,
            today=today,
            curve_start_datetime=courbe_debut,
            curve_end_datetime=courbe_fin,
        )

    def _period_bounds(
        self,
        today: date,
        periode: str,
        date_custom: Optional[str],
    ) -> tuple[datetime, datetime, datetime, datetime]:
        if periode == "custom":
            custom_day = self._parse_custom_date(date_custom)
            previous_day = custom_day - timedelta(days=1)
            return (
                datetime.combine(custom_day, time.min),
                datetime.combine(custom_day, time.max),
                datetime.combine(previous_day, time.min),
                datetime.combine(previous_day, time.max),
            )

        if periode == "7d":
            start_date = today - timedelta(days=7)
            previous_start = today - timedelta(days=14)
            previous_end = today - timedelta(days=7)
            return (
                datetime.combine(start_date, time.min),
                datetime.combine(today, time.max),
                datetime.combine(previous_start, time.min),
                datetime.combine(previous_end, time.max),
            )

        if periode == "30d":
            start_date = today - timedelta(days=30)
            previous_start = today - timedelta(days=60)
            previous_end = today - timedelta(days=30)
            return (
                datetime.combine(start_date, time.min),
                datetime.combine(today, time.max),
                datetime.combine(previous_start, time.min),
                datetime.combine(previous_end, time.max),
            )

        if periode == "month":
            month_start = today.replace(day=1)
            previous_month_end = month_start - timedelta(days=1)
            previous_month_start = previous_month_end.replace(day=1)
            return (
                datetime.combine(month_start, time.min),
                datetime.combine(today, time.max),
                datetime.combine(previous_month_start, time.min),
                datetime.combine(previous_month_end, time.max),
            )

        yesterday = today - timedelta(days=1)
        return (
            datetime.combine(today, time.min),
            datetime.combine(today, time.max),
            datetime.combine(yesterday, time.min),
            datetime.combine(yesterday, time.max),
        )

    def _parse_custom_date(self, date_custom: Optional[str]) -> date:
        if not date_custom:
            raise HTTPException(status_code=400, detail="date_custom est requis pour la periode custom.")

        try:
            return datetime.strptime(date_custom, "%Y-%m-%d").date()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="date_custom doit etre au format YYYY-MM-DD.") from exc

    def _curve_bounds(
        self,
        periode: str,
        date_debut: datetime,
        date_fin: datetime,
    ) -> tuple[datetime, datetime]:
        if periode == "custom":
            curve_start_date = date_fin.date() - timedelta(days=29)
            return datetime.combine(curve_start_date, time.min), date_fin

        return date_debut, date_fin
