from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class DashboardPointDTO(BaseModel):
    date: str
    ca: float = 0.0
    nb_commandes: int = 0


class DashboardStatutDTO(BaseModel):
    statut: str
    count: int = 0
    pourcentage: float = 0.0


class DashboardPaiementDTO(BaseModel):
    mode: str
    count: int = 0
    montant: float = 0.0
    pourcentage: float = 0.0


class DashboardDTO(BaseModel):
    periode: str
    date_custom: Optional[str] = None
    date_debut: datetime
    date_fin: datetime
    derniere_maj: datetime

    total_commandes: int = 0
    total_commandes_precedent: int = 0
    commandes_livrees: int = 0
    commandes_livrees_precedent: int = 0
    commandes_en_route: int = 0
    commandes_annulees: int = 0
    commandes_absentes: int = 0
    taux_livraison: float = 0.0
    taux_absence: float = 0.0

    ca_total: float = 0.0
    ca_total_precedent: float = 0.0
    ca_cod: float = 0.0
    ca_wallet: float = 0.0
    ca_cmi: float = 0.0
    panier_moyen: float = 0.0

    total_clients_actifs: int = 0
    nouveaux_clients: int = 0
    nouveaux_clients_precedent: int = 0
    clients_blacklistes: int = 0

    dernier_jit_statut: Optional[str] = None
    dernier_jit_volume: float = 0.0
    dernier_jit_nb_commandes: int = 0
    dernier_jit_date: Optional[datetime] = None
    jit_execute_aujourdhui: bool = False

    livreurs_disponibles: int = 0
    tournees_actives: int = 0

    cod_confirmes: int = 0
    cod_annules: int = 0
    taux_confirmation_cod: float = 0.0

    nouveaux_blacklistes: int = 0
    blacklists_leves: int = 0

    courbe_ca: List[DashboardPointDTO] = []
    repartition_statuts: List[DashboardStatutDTO] = []
    repartition_paiements: List[DashboardPaiementDTO] = []
