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
        zone_id: Optional[int] = None,
        nom_ville: Optional[str] = None,
    ) -> Optional[JITLogDTO]:
        """Crée un nouveau log d'exécution JIT"""
        pass

    @abstractmethod
    def get_last_log(self, session: Session) -> Optional[JITLogDTO]:
        """Retourne le dernier log d'exécution"""
        pass

    @abstractmethod
    def get_last_log_by_zone(self, session: Session, zone_id: int) -> Optional[JITLogDTO]:
        """Retourne le dernier log pour une zone donnée"""
        pass

    @abstractmethod
    def get_last_logs_all_zones(self, session: Session) -> List[JITLogDTO]:
        """Retourne le dernier log de chaque zone active"""
        pass

    @abstractmethod
    def get_logs_by_date_range(
        self,
        session: Session,
        date_debut: str,
        date_fin: str,
        zone_nom: Optional[str] = None,
    ) -> List[JITLogDTO]:
        """Retourne les logs d'une plage de dates, filtrable par nom de ville"""
        pass

    @abstractmethod
    def zone_deja_executee_aujourd_hui(self, session: Session, zone_id: int) -> bool:
        """Vérifie si un job JIT avec statut succès existe déjà pour cette zone aujourd'hui"""
        pass
