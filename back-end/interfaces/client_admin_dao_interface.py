from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from dto.client_admin_dto import AdminClientsPageDTO


class IClientAdminDao(ABC):

    @abstractmethod
    def get_clients_page(
        self,
        session: Session,
        *,
        search: Optional[str],
        page: int,
        page_size: int,
        blacklisted: Optional[bool],
    ) -> AdminClientsPageDTO:
        pass

    @abstractmethod
    def count_active_clients(self, session: Session) -> int:
        pass

    @abstractmethod
    def count_new_clients(
        self,
        session: Session,
        start_datetime: datetime,
        end_datetime: datetime,
    ) -> int:
        pass

    @abstractmethod
    def count_blacklisted_clients(self, session: Session) -> int:
        pass
