from abc import ABC, abstractmethod

from dto.supplier_dto import (
    AdminSupplierValidationDTO,
    SupplierOrdersDTO,
    SupplierPreparationDTO,
    SupplierPageDTO,
    SupplierProfileDTO,
    SupplierRequestDTO,
    SupplierStatsDTO,
    SupplierUpdateDTO,
)


class IFournisseurService(ABC):

    @abstractmethod
    def __enter__(self):
        pass

    @abstractmethod
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    @abstractmethod
    def submit_supplier_request(self, user_id: int, payload: SupplierRequestDTO) -> SupplierProfileDTO:
        pass

    @abstractmethod
    def validate_supplier_request(self, admin_user_id: int, payload: AdminSupplierValidationDTO) -> SupplierProfileDTO:
        pass

    @abstractmethod
    def get_supplier_profile(self, user_id: int) -> SupplierProfileDTO:
        pass

    @abstractmethod
    def update_supplier_profile(self, user_id: int, payload: SupplierUpdateDTO) -> SupplierProfileDTO:
        pass

    @abstractmethod
    def get_pending_requests(self) -> list:
        pass

    @abstractmethod
    def get_all_fournisseurs(
        self,
        *,
        statut: str | None,
        ville: str | None,
        search: str | None,
        page: int,
        page_size: int,
    ) -> SupplierPageDTO:
        pass

    @abstractmethod
    def get_supplier_stats(self, user_id: int) -> SupplierStatsDTO:
        pass

    @abstractmethod
    def get_supplier_orders(self, user_id: int) -> SupplierOrdersDTO:
        pass

    @abstractmethod
    def get_supplier_preparation(self, user_id: int) -> SupplierPreparationDTO:
        pass

    @abstractmethod
    def suspend_supplier(self, admin_user_id: int, supplier_user_id: int) -> SupplierProfileDTO:
        pass

    @abstractmethod
    def reactivate_supplier(self, admin_user_id: int, supplier_user_id: int) -> SupplierProfileDTO:
        pass
