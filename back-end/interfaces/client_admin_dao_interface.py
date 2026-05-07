from abc import ABC, abstractmethod
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
