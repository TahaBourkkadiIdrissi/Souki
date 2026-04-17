from abc import ABC, abstractmethod
from sqlalchemy.orm import Session
from typing import Optional
from entities.commande_vocale_entity import CommandeVocale


class ICommandeVocaleDao(ABC):

    @abstractmethod
    def create_commande(
        self, session: Session, transcription: str, json_brut: str, langue: str
    ) -> Optional[CommandeVocale]:
        """Crée une commande vocale en BDD."""
        pass

    @abstractmethod
    def create_ligne(
        self, session: Session, commande_id: int, product_id: int,
        qte_demandee: float, qte_effective: float, prix: float,
        sous_total: float, message: Optional[str]
    ) -> bool:
        """Crée une ligne de commande vocale. Retourne True si succès."""
        pass
