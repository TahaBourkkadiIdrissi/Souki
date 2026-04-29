from abc import ABC, abstractmethod
from typing import Dict, Iterable

from sqlalchemy.orm import Session

from entities.cod_confirmation_log_entity import CODConfirmationLog


class ICODConfirmationLogDao(ABC):

    @abstractmethod
    def create_log(
        self,
        session: Session,
        *,
        commande_id: int,
        admin_id: int,
        statut: str,
    ) -> CODConfirmationLog:
        pass

    @abstractmethod
    def get_latest_logs_by_commande_ids(
        self,
        session: Session,
        commande_ids: Iterable[int],
    ) -> Dict[int, CODConfirmationLog]:
        pass
