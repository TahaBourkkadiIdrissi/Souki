from abc import ABC, abstractmethod
from typing import Dict, Optional

from sqlalchemy.orm import Session

from dto.jit_dto import JITLogDTO, ResultatAgregationJIT, ZoneJITDTO


class IJITService(ABC):
    """Interface pour le service d'agrégation JIT"""

    @abstractmethod
    def agreger_commandes(
        self, session: Session, zone: Optional[ZoneJITDTO] = None
    ) -> ResultatAgregationJIT:
        """Agrège les commandes confirmées (filtrées par zone si fournie)."""
        pass

    @abstractmethod
    def verrouiller_commandes(
        self, session: Session, actor_id: int = 0, zone: Optional[ZoneJITDTO] = None
    ) -> int:
        """Verrouille les commandes (filtrées par zone si fournie)."""
        pass

    @abstractmethod
    def deverrouiller_commandes(
        self, session: Session, actor_id: int = 0, zone_id: Optional[int] = None
    ) -> Dict:
        """Déverrouille les commandes (scope zone si zone_id fourni)."""
        pass

    @abstractmethod
    def executer_job_jit(self, session: Session, actor_id: int = 0) -> JITLogDTO:
        """Execute le job JIT global (toutes zones confondues)."""
        pass

    @abstractmethod
    def executer_job_jit_regional(self, actor_id: int = 0) -> Dict[str, dict]:
        """Execute le job JIT pour chaque zone active indépendamment."""
        pass

    @abstractmethod
    def executer_job_jit_zone(self, zone_id: int, actor_id: int = 0) -> JITLogDTO:
        """Execute le job JIT pour une seule zone (test ou rattrapage)."""
        pass
