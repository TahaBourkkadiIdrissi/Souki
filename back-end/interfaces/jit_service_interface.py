from abc import ABC, abstractmethod
from sqlalchemy.orm import Session
from dto.jit_dto import ResultatAgregationJIT, JITLogDTO


class IJITService(ABC):
    """Interface pour le service d'agrégation JIT"""

    @abstractmethod
    def agreger_commandes(self, session: Session) -> ResultatAgregationJIT:
        """
        Agrège toutes les commandes confirmées et les abonnements actifs.
        Calcule les volumes avec buffer 10% et arrondit à la caisse entière.
        """
        pass

    @abstractmethod
    def verrouiller_commandes(self, session: Session, actor_id: int = 0) -> int:
        """
        Verrouille toutes les commandes en statut 'Confirmée'.
        Retourne le nombre de commandes verrouillées.
        """
        pass

    @abstractmethod
    def executer_job_jit(self, session: Session, actor_id: int = 0) -> JITLogDTO:
        """
        Exécute le job JIT complet :
        1. Agrège les commandes
        2. Verrouille les commandes
        3. Crée un log avec la liste d'achats en base de données
        """
        pass
