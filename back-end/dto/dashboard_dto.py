from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class CourbeCADTO(BaseModel):
    date: str
    ca: float = 0.0
    nb_commandes: int = 0


class RepartitionStatutDTO(BaseModel):
    statut: str
    count: int = 0


class RepartitionPaiementDTO(BaseModel):
    mode: str
    count: int = 0
    montant: float = 0.0


class DashboardDTO(BaseModel):
    total_commandes: int = 0
    commandes_livrees: int = 0
    commandes_en_route: int = 0
    commandes_annulees: int = 0
    commandes_absentes: int = 0
    taux_livraison: float = 0.0

    ca_total: float = 0.0
    ca_cod: float = 0.0
    ca_wallet: float = 0.0
    ca_cmi: float = 0.0

    total_clients_actifs: int = 0
    nouveaux_clients: int = 0
    clients_blacklistes: int = 0

    dernier_jit_statut: Optional[str] = None
    dernier_jit_volume: float = 0.0
    dernier_jit_date: Optional[datetime] = None

    livreurs_disponibles: int = 0
    tournees_actives: int = 0

    cod_confirmes: int = 0
    cod_annules: int = 0

    nouveaux_blacklistes: int = 0
    blacklists_leves: int = 0

    total_soldes_wallets: float = 0.0

    courbe_ca: List[CourbeCADTO] = []
    repartition_statuts: List[RepartitionStatutDTO] = []
    repartition_paiements: List[RepartitionPaiementDTO] = []
