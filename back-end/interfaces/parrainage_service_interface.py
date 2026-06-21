from abc import ABC, abstractmethod
from typing import Optional

from sqlalchemy.orm import Session

from entities.parrainage_entity import Parrainage


class IParrainageService(ABC):

    @abstractmethod
    def __enter__(self):
        pass

    @abstractmethod
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    @abstractmethod
    def generate_unique_code(self, session: Session) -> str:
        pass

    @abstractmethod
    def create_pending_referral(
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
    def get_referral_by_filleul(
        self,
        session: Session,
        filleul_id: int,
        *,
        for_update: bool = False,
    ) -> Optional[Parrainage]:
        pass

    @abstractmethod
    def convert_on_delivery(self, session: Session, *, filleul_id: int) -> Optional[Parrainage]:
        pass
