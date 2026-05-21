from typing import List, Optional

from sqlalchemy.orm import Session

from dto.jit_dto import ZoneJITDTO
from entities.zone_jit_entity import ZoneJIT
from interfaces.zone_jit_dao_interface import IZoneJITDao


class ZoneJITDaoBD(IZoneJITDao):
    """DAO pour la gestion des zones JIT géographiques"""

    def _to_dto(self, zone: ZoneJIT) -> ZoneJITDTO:
        created = zone.created_at
        return ZoneJITDTO(
            id=int(zone.id),  # type: ignore
            nom_ville=str(zone.nom_ville),  # type: ignore
            lat_centre=float(zone.lat_centre),  # type: ignore
            lng_centre=float(zone.lng_centre),  # type: ignore
            rayon_km=float(zone.rayon_km),  # type: ignore
            fournisseur_id=int(zone.fournisseur_id) if zone.fournisseur_id else None,  # type: ignore
            actif=bool(zone.actif),  # type: ignore
            created_at=created.isoformat() if created else None,
        )

    def get_zones_actives(self, session: Session) -> List[ZoneJITDTO]:
        try:
            zones = session.query(ZoneJIT).filter(ZoneJIT.actif == True).all()
            return [self._to_dto(z) for z in zones]
        except Exception as e:
            print(f"Erreur get_zones_actives: {e}")
            return []

    def get_zone_by_id(self, session: Session, zone_id: int) -> Optional[ZoneJITDTO]:
        try:
            zone = session.query(ZoneJIT).filter(ZoneJIT.id == zone_id).first()
            return self._to_dto(zone) if zone else None
        except Exception as e:
            print(f"Erreur get_zone_by_id: {e}")
            return None

    def get_all_zones(self, session: Session) -> List[ZoneJITDTO]:
        try:
            zones = session.query(ZoneJIT).all()
            return [self._to_dto(z) for z in zones]
        except Exception as e:
            print(f"Erreur get_all_zones: {e}")
            return []

    def create_zone(self, session: Session, dto: ZoneJITDTO) -> Optional[ZoneJITDTO]:
        try:
            zone = ZoneJIT(
                nom_ville=dto.nom_ville,
                lat_centre=dto.lat_centre,
                lng_centre=dto.lng_centre,
                rayon_km=dto.rayon_km,
                fournisseur_id=dto.fournisseur_id,
                actif=dto.actif,
            )
            session.add(zone)
            session.flush()
            return ZoneJITDTO(
                id=int(zone.id),  # type: ignore
                nom_ville=str(zone.nom_ville),  # type: ignore
                lat_centre=float(zone.lat_centre),  # type: ignore
                lng_centre=float(zone.lng_centre),  # type: ignore
                rayon_km=float(zone.rayon_km),  # type: ignore
                fournisseur_id=int(zone.fournisseur_id) if zone.fournisseur_id else None,  # type: ignore
                actif=bool(zone.actif),  # type: ignore
                created_at=None,
            )
        except Exception as e:
            print(f"Erreur create_zone: {e}")
            return None

    def update_zone(self, session: Session, zone_id: int, dto: ZoneJITDTO) -> Optional[ZoneJITDTO]:
        try:
            zone = session.query(ZoneJIT).filter(ZoneJIT.id == zone_id).first()
            if not zone:
                return None
            zone.nom_ville = dto.nom_ville  # type: ignore
            zone.lat_centre = dto.lat_centre  # type: ignore
            zone.lng_centre = dto.lng_centre  # type: ignore
            zone.rayon_km = dto.rayon_km  # type: ignore
            zone.fournisseur_id = dto.fournisseur_id  # type: ignore
            if dto.actif is not None:
                zone.actif = dto.actif  # type: ignore
            session.flush()
            return self._to_dto(zone)
        except Exception as e:
            print(f"Erreur update_zone: {e}")
            return None

    def toggle_actif(self, session: Session, zone_id: int) -> Optional[ZoneJITDTO]:
        try:
            zone = session.query(ZoneJIT).filter(ZoneJIT.id == zone_id).first()
            if not zone:
                return None
            zone.actif = not bool(zone.actif)  # type: ignore
            session.flush()
            return self._to_dto(zone)
        except Exception as e:
            print(f"Erreur toggle_actif: {e}")
            return None
