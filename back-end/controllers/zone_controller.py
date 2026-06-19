from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from auth_dependencies import require_permission
from config import LocalSession
from dao.zone_jit_dao import ZoneJITDaoBD
from dto.jit_dto import ZoneJITDTO
from entities.fournisseur_entity import Fournisseur


router_admin_zones = APIRouter(prefix="/api/admin/zones", tags=["Admin Zones"])


class ZoneAdminPayload(BaseModel):
    nom_ville: str = Field(min_length=1, max_length=100)
    lat_centre: float = Field(ge=-90, le=90)
    lng_centre: float = Field(ge=-180, le=180)
    rayon_km: float = Field(gt=0, le=500)
    fournisseur_id: int
    actif: bool = True


def _validate_supplier(session, fournisseur_id: int) -> None:
    fournisseur = (
        session.query(Fournisseur)
        .filter(Fournisseur.user_id == fournisseur_id)
        .first()
    )
    if not fournisseur:
        raise HTTPException(status_code=422, detail="Fournisseur introuvable.")
    if fournisseur.statut != "APPROVED":
        raise HTTPException(
            status_code=422,
            detail="La zone doit être rattachée à un fournisseur approuvé.",
        )


def _as_zone_dto(payload: ZoneAdminPayload) -> ZoneJITDTO:
    return ZoneJITDTO(**payload.model_dump())


@router_admin_zones.get("", response_model=list[ZoneJITDTO])
def list_admin_zones(
    principal=Depends(require_permission("admin.panel.access")),
):
    _ = principal
    session = LocalSession()
    try:
        return ZoneJITDaoBD().get_all_zones(session)
    finally:
        session.close()


@router_admin_zones.post(
    "",
    response_model=ZoneJITDTO,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_zone(
    payload: ZoneAdminPayload,
    principal=Depends(require_permission("admin.panel.access")),
):
    _ = principal
    session = LocalSession()
    try:
        _validate_supplier(session, payload.fournisseur_id)
        zone = ZoneJITDaoBD().create_zone(session, _as_zone_dto(payload))
        if not zone:
            raise HTTPException(status_code=500, detail="Impossible de créer la zone.")
        session.commit()
        return zone
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail="Erreur lors de la création de la zone.") from exc
    finally:
        session.close()


@router_admin_zones.put("/{zone_id}", response_model=ZoneJITDTO)
def update_admin_zone(
    zone_id: int,
    payload: ZoneAdminPayload,
    principal=Depends(require_permission("admin.panel.access")),
):
    _ = principal
    session = LocalSession()
    try:
        _validate_supplier(session, payload.fournisseur_id)
        zone = ZoneJITDaoBD().update_zone(session, zone_id, _as_zone_dto(payload))
        if not zone:
            raise HTTPException(status_code=404, detail="Zone introuvable.")
        session.commit()
        return zone
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail="Erreur lors de la mise à jour de la zone.") from exc
    finally:
        session.close()


@router_admin_zones.delete("/{zone_id}", response_model=ZoneJITDTO)
def deactivate_admin_zone(
    zone_id: int,
    principal=Depends(require_permission("admin.panel.access")),
):
    _ = principal
    session = LocalSession()
    try:
        zone = ZoneJITDaoBD().deactivate_zone(session, zone_id)
        if not zone:
            raise HTTPException(status_code=404, detail="Zone introuvable.")
        session.commit()
        return zone
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail="Erreur lors de la désactivation de la zone.") from exc
    finally:
        session.close()
