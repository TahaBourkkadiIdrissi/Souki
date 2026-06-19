from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CommandeExceptionDTO(BaseModel):
    id: int
    statut: Optional[str] = None
    raisons: list[str] = Field(default_factory=list)
    date_commande: Optional[datetime] = None
    client_nom: str
    client_phone: Optional[str] = None
    ville: Optional[str] = None
    montant_total: float = 0
    fournisseur_id: Optional[int] = None
    fournisseur_nom: Optional[str] = None
    tournee_id: Optional[int] = None
    livreur_id: Optional[int] = None


class CommandeExceptionsPageDTO(BaseModel):
    status: str = "success"
    items: list[CommandeExceptionDTO] = Field(default_factory=list)
    total: int
    page: int
    page_size: int
    total_pages: int


class RattacherFournisseurDTO(BaseModel):
    fournisseur_id: int


class ReassignerCommandeDTO(BaseModel):
    nouvelle_tournee_id: int


class CommandeAdminActionDTO(BaseModel):
    status: str = "success"
    commande_id: int
    nouveau_statut: Optional[str] = None
    fournisseur_id: Optional[int] = None
    tournee_id: Optional[int] = None
    idempotent: bool = False
