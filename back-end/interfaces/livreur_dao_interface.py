from abc import ABC, abstractmethod
from typing import Any, Iterable

from sqlalchemy.orm import Session


class ILivreurDao(ABC):

    @abstractmethod
    def get_tournee_rows(
        self,
        session: Session,
        livreur_id: int,
        visible_statuses: Iterable[str],
    ) -> list[dict[str, Any]]:
        pass

    @abstractmethod
    def start_tournee(
        self,
        session: Session,
        livreur_id: int,
        pending_statuses: Iterable[str],
        started_status: str,
    ) -> int:
        pass

    @abstractmethod
    def count_by_statuses(
        self,
        session: Session,
        livreur_id: int,
        statuses: Iterable[str],
    ) -> int:
        pass
