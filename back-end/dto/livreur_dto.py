from datetime import date, datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DeliveryTargetStatus(str, Enum):
    EN_ROUTE = "EN_ROUTE"
    LIVRE = "LIVRE"
    ABSENT = "ABSENT"
    REFUS = "REFUS"


class TourneeItemDTO(BaseModel):
    commande_id: int
    client_phone: Optional[str] = None
    client_label: str
    street: Optional[str] = None
    neighborhood: Optional[str] = None
    details: Optional[str] = None
    full_address: str
    colis_count: int = Field(default=0, ge=0)
    creneau_livraison: Optional[str] = None
    statut: str
    status_version: int = Field(default=1, ge=1)
    enroute_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    absent_at: Optional[datetime] = None
    montant_total: float = 0.0
    mode_paiement: Optional[str] = None
    payment_validated: Optional[bool] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class TourneeResponseDTO(BaseModel):
    status: str = "success"
    date_jour: date
    available_after: str = "07:00"
    sort_strategy: str
    tournee_started: bool = False
    items: List[TourneeItemDTO] = Field(default_factory=list)


class DemarrerTourneeResponseDTO(BaseModel):
    status: str = "success"
    updated_count: int = 0
    previous_status: str
    new_status: str
    message: str


class DeliveryEventRequestDTO(BaseModel):
    target_status: DeliveryTargetStatus
    client_event_id: UUID
    device_timestamp: datetime
    expected_version: Optional[int] = Field(default=None, ge=1)


class DeliveryEventResponseDTO(BaseModel):
    status: str = "success"
    event_id: UUID
    client_event_id: UUID
    commande_id: int
    previous_status: str
    new_status: str
    status_version: int = Field(ge=1)
    enroute_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    absent_at: Optional[datetime] = None
    device_timestamp: datetime
    server_timestamp: datetime
    idempotent: bool = False
    message: str


class CodValidationResponseDTO(BaseModel):
    status: str = "success"
    commande_id: int
    payment_validated: bool = True
    mode_paiement: Optional[str] = None
    montant_total: float = 0.0
    idempotent: bool = False
    message: str
