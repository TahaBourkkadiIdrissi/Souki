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
    # Indices de parrainage suspect, calcules sans exposer les donnees :
    # MEME_ADRESSE (adresses a moins de 30 m), MEME_CONNEXION (IP d'inscription du filleul
    # vue sur une session du parrain), IP_PARTAGEE (autres filleuls du meme parrain, meme IP).
    signaux: List[str] = []


class ParrainageContactsDTO(BaseModel):
    """Contacts complets d'un parrainage, renvoyes uniquement sur demande explicite (journalisee)."""
    parrainage_id: int
    parrain_id: int
    parrain_contact: Optional[str] = None
    filleul_id: int
    filleul_contact: Optional[str] = None


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


class ParrainageFilleulClientDTO(BaseModel):
    """Filleul vu par son parrain : prenom et initiale seulement, jamais le contact."""
    prenom: str
    statut: str
    created_at: Optional[datetime] = None
    converted_at: Optional[datetime] = None


class ParrainageClientDTO(BaseModel):
    code: Optional[str] = None
    credit_par_filleul: float = 0.0
    plafond_filleuls: int = 0
    en_attente: int = 0
    convertis: int = 0
    gains_total: float = 0.0
    filleuls: List[ParrainageFilleulClientDTO] = []
