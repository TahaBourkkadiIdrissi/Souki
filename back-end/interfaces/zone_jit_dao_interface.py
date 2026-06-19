from abc import ABC, abstractmethod
from typing import List, Optional

from sqlalchemy.orm import Session

from dto.jit_dto import ZoneJITDTO


class IZoneJITDao(ABC):
    """Interface pour le DAO des zones JIT géographiques"""

    @abstractmethod
    def get_zones_actives(self, session: Session) -> List[ZoneJITDTO]:
        """Retourne toutes les zones actives"""
        pass

    @abstractmethod
    def get_zone_by_id(self, session: Session, zone_id: int) -> Optional[ZoneJITDTO]:
        """Retourne une zone par son id"""
        pass

    @abstractmethod
    def get_all_zones(self, session: Session) -> List[ZoneJITDTO]:
        """Retourne toutes les zones (actives et inactives)"""
        pass

    @abstractmethod
    def create_zone(self, session: Session, dto: ZoneJITDTO) -> Optional[ZoneJITDTO]:
        """Crée une nouvelle zone"""
        pass

    @abstractmethod
    def update_zone(self, session: Session, zone_id: int, dto: ZoneJITDTO) -> Optional[ZoneJITDTO]:
        """Met à jour une zone existante"""
        pass

    @abstractmethod
    def toggle_actif(self, session: Session, zone_id: int) -> Optional[ZoneJITDTO]:
        """Active ou désactive une zone"""
        pass

    @abstractmethod
    def deactivate_zone(self, session: Session, zone_id: int) -> Optional[ZoneJITDTO]:
        """Désactive une zone sans supprimer son historique"""
        pass
