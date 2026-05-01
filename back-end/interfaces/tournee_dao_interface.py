from abc import ABC, abstractmethod
from datetime import date
from typing import List

from sqlalchemy.orm import Session

from entities.tournee_entity import Tournee


class ITourneeDao(ABC):

    @abstractmethod
    def create_tournee(
        self,
        session: Session,
        livreur_id: int,
        date_tournee: date,
    ) -> Tournee:
        """Cree une tournee et laisse le service gerer la transaction."""
        pass

    @abstractmethod
    def get_tournees_by_date(self, session: Session, date_tournee: date) -> List[Tournee]:
        """Retourne les tournees planifiees pour une date."""
        pass

    @abstractmethod
    def get_tournees_with_details(self, session: Session, target_date: date) -> List[Tournee]:
        """Retourne les tournees avec livreur, commandes et adresses client."""
        pass

    @abstractmethod
    def get_tournee_by_id(
        self,
        session: Session,
        tournee_id: int,
        for_update: bool = False,
    ) -> Tournee | None:
        """Retourne une tournee par id, optionnellement verrouillee."""
        pass

    @abstractmethod
    def get_next_ordre_passage(self, session: Session, tournee_id: int) -> int:
        """Calcule le prochain ordre de passage pour une tournee."""
        pass
