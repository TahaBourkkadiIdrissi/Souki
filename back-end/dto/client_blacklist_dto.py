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
    commande_statut: Optional[str] = None
    commande_date: Optional[datetime] = None
    montant_perdu: float = 0.0
    admin_nom: Optional[str] = None

    class Config:
        from_attributes = True


class LiftBlacklistDTO(BaseModel):
    reason: Optional[str] = None


class BlacklistStatusDTO(BaseModel):
    is_blacklisted: bool
    last_action: Optional[str] = None
    last_reason: Optional[str] = None
    last_date: Optional[datetime] = None
    lift_notification_seen: bool = False


class LiftRequestDTO(BaseModel):
    motif: str


class LiftRejectDTO(BaseModel):
    motif: str


class PendingLiftRequestDTO(BaseModel):
    log_id: int
    client_id: int
    client_label: Optional[str] = None
    phone: Optional[str] = None
    motif: Optional[str] = None
    created_at: datetime


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


class BlacklistCommandeRefuseeDTO(BaseModel):
    log_id: int
    commande_id: Optional[int] = None
    client_id: int
    client_label: Optional[str] = None
    phone: Optional[str] = None
    date_refus: Optional[datetime] = None
    date_commande: Optional[datetime] = None
    statut_commande: Optional[str] = None
    montant_perdu: float = 0.0
    livreur_nom: Optional[str] = None
    quartier: Optional[str] = None
    motif: Optional[str] = None


class BlacklistReportDTO(BaseModel):
    mois: int
    annee: int
    total_refus: int
    total_perte: float = 0.0
    par_client: List[BlacklistParClientDTO] = []
    par_livreur: List[BlacklistParLivreurDTO] = []
    par_quartier: List[BlacklistParQuartierDTO] = []
    commandes_refusees: List[BlacklistCommandeRefuseeDTO] = []
