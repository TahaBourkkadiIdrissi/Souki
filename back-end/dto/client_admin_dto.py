from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class AdminClientDTO(BaseModel):
    client_id: int
    email: Optional[str] = None
    phone: Optional[str] = None
    nb_commandes: int = 0
    montant_total: float = 0.0
    mode_paiement_favori: Optional[str] = None
    is_blacklisted: bool = False
    date_inscription: Optional[datetime] = None


class AdminClientsPageDTO(BaseModel):
    items: List[AdminClientDTO]
    total: int
    total_commandes: int = 0
    montant_total_global: float = 0.0
    page: int
    page_size: int
    total_pages: int
