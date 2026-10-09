from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class OrderEditItemDTO(BaseModel):
    product_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0, le=10000, max_digits=9, decimal_places=3)


class OrderEditRequestDTO(BaseModel):
    items: list[OrderEditItemDTO] = Field(min_length=1, max_length=100)
    expected_version: int = Field(ge=1)

    @model_validator(mode="after")
    def unique_products(self):
        if len({item.product_id for item in self.items}) != len(self.items):
            raise ValueError("Un produit ne peut apparaître qu'une seule fois.")
        return self


class OrderEditSaveDTO(OrderEditRequestDTO):
    expected_total: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class OrderEditLineDTO(BaseModel):
    product_id: int
    name: str
    unit: str
    quantity: float
    unit_price: float
    subtotal: float


class OrderEditResponseDTO(BaseModel):
    commande_id: int
    version: int
    editable: bool
    reason: Optional[str] = None
    deadline: Optional[datetime] = None
    server_time: datetime
    date_livraison: Optional[date] = None
    creneau_livraison: Optional[str] = None
    mode_paiement: str
    items: list[OrderEditLineDTO]
    subtotal: float
    delivery_fee: float
    total: float
    previous_total: float
    difference: float
