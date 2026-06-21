from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from entities.client_entity import Client
from entities.parrainage_entity import Parrainage


class IParrainageDao(ABC):

    @abstractmethod
    def get_client_by_code(self, session: Session, code: str) -> Optional[Client]:
        pass

    @abstractmethod
    def code_exists(self, session: Session, code: str) -> bool:
        pass

    @abstractmethod
    def create_parrainage(
        self,
        session: Session,
        *,
        parrain_id: int,
        filleul_id: int,
        code_utilise: str,
        ip_inscription: Optional[str] = None,
        phone_filleul_snapshot: Optional[str] = None,
    ) -> Parrainage:
        pass

    @abstractmethod
    def get_by_filleul(
        self,
        session: Session,
        filleul_id: int,
        *,
        for_update: bool = False,
    ) -> Optional[Parrainage]:
        pass

    @abstractmethod
    def count_converted_by_parrain(self, session: Session, parrain_id: int) -> int:
        pass

    @abstractmethod
    def count_recent_by_ip(self, session: Session, ip: str, since: datetime) -> int:
        pass
