from abc import ABC, abstractmethod
from typing import List

from dto.supplier_dto import (
    SupplierCatalogueItemDTO,
    SupplierProductCreateDTO,
    SupplierProductOfferDTO,
    SupplierProductSelectionDTO,
    SupplierProductUpdateDTO,
    SupplierProductsListDTO,
)


class IFournisseurProduitService(ABC):

    @abstractmethod
    def __enter__(self):
        pass

    @abstractmethod
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    @abstractmethod
    def list_products(self, user_id: int) -> SupplierProductsListDTO:
        pass

    @abstractmethod
    def list_catalogue(self, user_id: int) -> List[SupplierCatalogueItemDTO]:
        pass

    @abstractmethod
    def add_product(self, user_id: int, payload: SupplierProductCreateDTO) -> SupplierProductOfferDTO:
        pass

    @abstractmethod
    def update_product(
        self,
        user_id: int,
        produit_id: int,
        payload: SupplierProductUpdateDTO,
    ) -> SupplierProductOfferDTO:
        pass

    @abstractmethod
    def remove_product(self, user_id: int, produit_id: int) -> None:
        pass

    @abstractmethod
    def set_selection(self, user_id: int, payload: SupplierProductSelectionDTO) -> SupplierProductsListDTO:
        pass
