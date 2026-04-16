from abc import ABC, abstractmethod
from typing import Optional
from sqlalchemy.orm import Session
from entities import CommandeVocale


class ICommandeVocaleDao(ABC):
    @abstractmethod
    def create_commande(
        self,
        session: Session,
        transcription: str,
        json_brut: str,
        langue: str
    ) -> Optional[CommandeVocale]:
        """Crée une nouvelle commande vocale"""
        pass

    @abstractmethod
    def create_ligne(
        self,
        session: Session,
        commande_id: int,
        product_id: int,
        qte_demandee: float,
        qte_effective: float,
        prix: float,
        sous_total: float,
        message: Optional[str]
    ) -> bool:
        """Ajoute une ligne à une commande"""
        pass
