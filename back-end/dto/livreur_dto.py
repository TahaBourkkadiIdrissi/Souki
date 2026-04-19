from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field


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
    montant_total: float = 0.0
    mode_paiement: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class TourneeResponseDTO(BaseModel):
    status: str = "success"
    date_jour: date
    available_after: str = "07:00"
    sort_strategy: str
    tournee_started: bool = False
    items: List[TourneeItemDTO] = []


class DemarrerTourneeResponseDTO(BaseModel):
    status: str = "success"
    updated_count: int = 0
    previous_status: str
    new_status: str
    message: str
