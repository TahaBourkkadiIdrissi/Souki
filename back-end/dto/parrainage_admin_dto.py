from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ParrainageAdminItemDTO(BaseModel):
    id: int
    parrain_id: int
    parrain_contact: Optional[str] = None
    code_utilise: str
    filleul_id: int
    filleul_contact: Optional[str] = None
    statut: str
    credit_total: float = 0.0
    created_at: Optional[datetime] = None
    converted_at: Optional[datetime] = None


class ParrainageTopParrainDTO(BaseModel):
    parrain_id: int
    parrain_contact: Optional[str] = None
    filleuls_convertis: int = 0
    credit_genere: float = 0.0


class ParrainageAdminOverviewDTO(BaseModel):
    total: int = 0
    en_attente: int = 0
    convertis: int = 0
    rejetes: int = 0
    taux_conversion: float = 0.0
    credit_distribue: float = 0.0
    top_parrains: List[ParrainageTopParrainDTO] = []
    recent: List[ParrainageAdminItemDTO] = []
