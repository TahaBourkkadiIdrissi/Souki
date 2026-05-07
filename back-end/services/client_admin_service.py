from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from dto.client_admin_dto import AdminClientsPageDTO
from interfaces.client_admin_dao_interface import IClientAdminDao
from interfaces.client_admin_service_interface import IClientAdminService


class ClientAdminService(IClientAdminService):

    PAGE_SIZE = 20

    def __init__(self, client_admin_dao: IClientAdminDao) -> None:
        self.client_admin_dao = client_admin_dao

    def get_clients_page(
        self,
        session: Session,
        *,
        search: Optional[str],
        page: int,
        blacklisted: Optional[bool],
    ) -> AdminClientsPageDTO:
        if page < 1:
            raise HTTPException(status_code=400, detail="Page invalide.")

        return self.client_admin_dao.get_clients_page(
            session,
            search=search,
            page=page,
            page_size=self.PAGE_SIZE,
            blacklisted=blacklisted,
        )
