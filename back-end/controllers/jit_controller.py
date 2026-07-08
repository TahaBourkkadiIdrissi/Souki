from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth_dependencies import require_permission
from config import LocalSession
from dao.jit_dao import JITDaoBD
from dao.zone_jit_dao import ZoneJITDaoBD
from dto.jit_dto import JITLogDTO, ResultatAgregationJIT, ZoneJITDTO
from services.business_errors import internal_error_http
from services.jit_service import JITAlreadyExecutedError, JITService


router_jit = APIRouter(prefix="/api/jit", tags=["JIT-Aggregation"])

# Standard unique d'autorisation (voir Documentation/STANDARD_AUTORISATIONS.md) :
# permission RBAC via require_permission, plus de verification manuelle de role.
get_admin_user = require_permission("admin.panel.access")


def get_jit_service():
    return JITService(JITDaoBD(), ZoneJITDaoBD())


# ============================================================
# Endpoints zones CRUD
# ============================================================

@router_jit.get("/zones", response_model=List[ZoneJITDTO])
async def get_zones(admin_user=Depends(get_admin_user)):
    """Liste toutes les zones JIT (actives et inactives). ADMIN ONLY."""
    session = LocalSession()
    try:
        dao = ZoneJITDaoBD()
        return dao.get_all_zones(session)
    except Exception as e:
        raise internal_error_http("jit.zones.list", e)
    finally:
        session.close()


@router_jit.post("/zones", response_model=ZoneJITDTO)
async def create_zone(
    payload: ZoneJITDTO,
    admin_user=Depends(get_admin_user),
):
    """Crée une nouvelle zone JIT géographique. ADMIN ONLY."""
    if not (-90 <= payload.lat_centre <= 90):
        raise HTTPException(status_code=422, detail="lat_centre doit être entre -90 et 90")
    if not (-180 <= payload.lng_centre <= 180):
        raise HTTPException(status_code=422, detail="lng_centre doit être entre -180 et 180")
    if payload.rayon_km <= 0:
        raise HTTPException(status_code=422, detail="rayon_km doit être > 0")

    session = LocalSession()
    try:
        dao = ZoneJITDaoBD()
        zone = dao.create_zone(session, payload)
        if not zone:
            raise HTTPException(status_code=500, detail="Impossible de créer la zone")
        session.commit()
        return zone
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise internal_error_http("jit.zones.create", e)
    finally:
        session.close()


@router_jit.patch("/zones/{zone_id}", response_model=ZoneJITDTO)
async def update_zone(
    zone_id: int,
    payload: ZoneJITDTO,
    admin_user=Depends(get_admin_user),
):
    """Met à jour une zone JIT. ADMIN ONLY."""
    if not (-90 <= payload.lat_centre <= 90):
        raise HTTPException(status_code=422, detail="lat_centre doit être entre -90 et 90")
    if not (-180 <= payload.lng_centre <= 180):
        raise HTTPException(status_code=422, detail="lng_centre doit être entre -180 et 180")
    if payload.rayon_km <= 0:
        raise HTTPException(status_code=422, detail="rayon_km doit être > 0")

    session = LocalSession()
    try:
        dao = ZoneJITDaoBD()
        zone = dao.update_zone(session, zone_id, payload)
        if not zone:
            raise HTTPException(status_code=404, detail=f"Zone {zone_id} introuvable")
        session.commit()
        return zone
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise internal_error_http("jit.zones.update", e)
    finally:
        session.close()


@router_jit.post("/zones/{zone_id}/toggle", response_model=ZoneJITDTO)
async def toggle_zone(
    zone_id: int,
    admin_user=Depends(get_admin_user),
):
    """Active ou désactive une zone JIT. ADMIN ONLY."""
    session = LocalSession()
    try:
        dao = ZoneJITDaoBD()
        zone = dao.toggle_actif(session, zone_id)
        if not zone:
            raise HTTPException(status_code=404, detail=f"Zone {zone_id} introuvable")
        session.commit()
        return zone
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise internal_error_http("jit.zones.toggle", e)
    finally:
        session.close()


# ============================================================
# Endpoints exécution JIT
# ============================================================

@router_jit.post("/agreguer", response_model=ResultatAgregationJIT)
async def agreger_commandes(
    admin_user=Depends(get_admin_user),
    service: JITService = Depends(get_jit_service),
):
    """
    Agrège toutes les commandes confirmées (test, sans zone).
    ADMIN ONLY.
    """
    session = LocalSession()
    try:
        return service.agreger_commandes(session)
    except Exception as e:
        session.rollback()
        raise internal_error_http("jit.agreguer", e)
    finally:
        session.close()


@router_jit.post("/executer")
async def executer_job_jit(
    admin_user=Depends(get_admin_user),
    service: JITService = Depends(get_jit_service),
):
    """
    Execute le job JIT régional (toutes les zones actives en parallèle).
    Retourne un résumé par ville. ADMIN ONLY.
    """
    try:
        resultats = service.executer_job_jit_regional(actor_id=int(admin_user.user_id))
        return {
            "statut": "termine",
            "zones": resultats,
            "nombre_zones": len(resultats),
        }
    except JITAlreadyExecutedError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise internal_error_http("jit.executer", e)


@router_jit.post("/executer/{zone_id}", response_model=JITLogDTO)
async def executer_job_jit_zone(
    zone_id: int,
    admin_user=Depends(get_admin_user),
    service: JITService = Depends(get_jit_service),
):
    """
    Execute le job JIT pour une seule zone (test ou rattrapage).
    ADMIN ONLY.
    """
    try:
        log = service.executer_job_jit_zone(zone_id=zone_id, actor_id=int(admin_user.user_id))
        return log
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise internal_error_http("jit.executer.zone", e)


@router_jit.post("/deverrouiller")
async def deverrouiller_commandes_jit(
    zone_id: Optional[int] = Query(default=None, description="ID de zone (optionnel, déverrouille tout si absent)"),
    admin_user=Depends(get_admin_user),
    service: JITService = Depends(get_jit_service),
):
    """
    Déverrouille les commandes verrouillées par le JIT.
    Si zone_id fourni, limite au périmètre de cette zone. ADMIN ONLY.
    """
    session = LocalSession()
    try:
        resultat = service.deverrouiller_commandes(
            session, actor_id=int(admin_user.user_id), zone_id=zone_id
        )
        nombre = resultat.get("nombre_deverrouillees", 0)
        session.commit()
        return {
            "nombre_commandes": nombre,
            "nombre_deverrouillees": nombre,
            "commandes": resultat.get("commandes", []),
            "statut": "succes",
            "message": f"{nombre} commande(s) deverrouillee(s).",
        }
    except Exception as e:
        session.rollback()
        raise internal_error_http("jit.deverrouiller", e)
    finally:
        session.close()


# ============================================================
# Endpoints logs
# ============================================================

@router_jit.get("/logs/dernier")
async def get_dernier_log(admin_user=Depends(get_admin_user)):
    """
    Retourne le dernier log par zone active (liste).
    Si aucune zone configurée, retourne le dernier log global. ADMIN ONLY.
    """
    session = LocalSession()
    try:
        jit_dao = JITDaoBD()
        logs_zones = jit_dao.get_last_logs_all_zones(session)

        if logs_zones:
            return {"logs": logs_zones, "nombre": len(logs_zones), "mode": "regional"}

        # Fallback : dernier log global
        log = jit_dao.get_last_log(session)
        if not log:
            raise HTTPException(status_code=404, detail="Aucun log JIT trouvé")
        return {"logs": [log], "nombre": 1, "mode": "global"}
    except HTTPException:
        raise
    except Exception as e:
        raise internal_error_http("jit.logs.dernier", e)
    finally:
        session.close()


@router_jit.get("/logs/{date_debut}/{date_fin}")
async def get_logs_par_plage(
    date_debut: str,
    date_fin: str,
    zone: Optional[str] = Query(default=None, description="Filtrer par nom de ville"),
    admin_user=Depends(get_admin_user),
):
    """
    Retourne les logs JIT d'une plage de dates.
    Format des dates: YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS.
    Paramètre optionnel ?zone=fes pour filtrer par ville. ADMIN ONLY.
    """
    session = LocalSession()
    try:
        jit_dao = JITDaoBD()
        logs = jit_dao.get_logs_by_date_range(session, date_debut, date_fin, zone_nom=zone)
        return {"logs": logs, "nombre": len(logs)}
    except Exception as e:
        raise internal_error_http("jit.logs.plage", e)
    finally:
        session.close()
