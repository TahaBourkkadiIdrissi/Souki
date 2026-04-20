from abc import ABC, abstractmethod
from typing import List, Optional
from sqlalchemy.orm import Session
from dto.jit_dto import JITLogDTO


class IJITDao(ABC):
    """Interface pour le DAO JIT Log"""

    @abstractmethod
    def create_log(
        self,
        session: Session,
        volume_total: float,
        nombre_commandes: int,
        nombre_abonnements: int,
        statut: str,
        details_volumes: Optional[dict] = None,
        message_alerte: Optional[str] = None,
    ) -> Optional[JITLogDTO]:
        """Crée un nouveau log d'exécution JIT"""
        pass

    @abstractmethod
    def get_last_log(self, session: Session) -> Optional[JITLogDTO]:
        """Retourne le dernier log d'exécution"""
        pass

    @abstractmethod
    def get_logs_by_date_range(
        self, session: Session, date_debut: str, date_fin: str
    ) -> List[JITLogDTO]:
        """Retourne les logs d'une plage de dates"""
        pass
