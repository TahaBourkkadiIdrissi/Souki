from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ClientBlacklistDTO(BaseModel):
    client_id: int
    email: Optional[str] = None
    phone: Optional[str] = None
    is_blacklisted: bool
    date_blacklist: Optional[datetime] = None
    motif: Optional[str] = None
    source: Optional[str] = None
    livreur_nom: Optional[str] = None
    commande_id: Optional[int] = None
    admin_nom: Optional[str] = None

    class Config:
        from_attributes = True


class LiftBlacklistDTO(BaseModel):
    reason: Optional[str] = None


class BlacklistParClientDTO(BaseModel):
    client_id: int
    email: Optional[str] = None
    phone: Optional[str] = None
    nb_refus: int
    montant_perdu: float


class BlacklistParLivreurDTO(BaseModel):
    livreur_id: int
    livreur_nom: Optional[str] = None
    nb_refus: int


class BlacklistParQuartierDTO(BaseModel):
    quartier: Optional[str] = None
    nb_refus: int
    montant_perdu: float


class BlacklistReportDTO(BaseModel):
    mois: int
    annee: int
    total_refus: int
    par_client: List[BlacklistParClientDTO] = []
    par_livreur: List[BlacklistParLivreurDTO] = []
    par_quartier: List[BlacklistParQuartierDTO] = []
