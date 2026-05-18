from fastapi import APIRouter, Depends, HTTPException
import os

from config import LocalSession
from controllers.auth_controller import get_current_user
from dao.jit_dao import JITDaoBD
from services.jit_service import JITAlreadyExecutedError, JITService
from dto.jit_dto import ResultatAgregationJIT, JITLogDTO


router_jit = APIRouter(prefix="/api/jit", tags=["JIT-Aggregation"])


def get_admin_user(user=Depends(get_current_user)):
    """
    Dépendance pour vérifier que l'utilisateur est ADMIN.
    Lève une exception 403 si ce n'est pas un admin.
    """
    if not user or user.primary_role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Accès refusé. Seul l'administrateur peut accéder à ce endpoint."
        )
    return user


def get_jit_service():
    """Dépendance pour obtenir le service JIT"""
    jit_dao = JITDaoBD()
    return JITService(jit_dao)


@router_jit.post("/agreguer", response_model=ResultatAgregationJIT)
async def agreger_commandes(
    admin_user=Depends(get_admin_user),
    service: JITService = Depends(get_jit_service)
):
    """
    Agrège toutes les commandes confirmées et calcule les volumes d'achat.
    Endpoint de test - à utiliser manuellement avant 20h00.
    
    🔒 ADMIN ONLY - Authentification requise
    """
    try:
        session = LocalSession()
        resultat = service.agreger_commandes(session)
        session.close()
        return resultat
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'agrégation: {str(e)}")


@router_jit.post("/executer", response_model=JITLogDTO)
async def executer_job_jit(
    admin_user=Depends(get_admin_user),
    service: JITService = Depends(get_jit_service)
):
    """
    Execute le job JIT complet:
    1. Agrege les commandes
    2. Verrouille les commandes
    3. Enregistre un log JIT consultable dans le back-office

    ADMIN ONLY - Authentification requise
    """
    session = LocalSession()
    try:
        # Enregistre un log JIT consultable dans le back-office
        log = service.executer_job_jit(session, actor_id=int(admin_user.user_id))

        if not log:
            raise HTTPException(status_code=500, detail="Impossible de creer le log JIT")

        return log
    except JITAlreadyExecutedError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'execution JIT: {str(e)}")
    finally:
        session.close()

@router_jit.post("/deverrouiller")
async def deverrouiller_commandes_jit(
    admin_user=Depends(get_admin_user),
    service: JITService = Depends(get_jit_service)
):
    """
    Deverrouille les commandes verrouillees par le JIT.

    ADMIN ONLY - Authentification requise
    """
    session = LocalSession()
    try:
        resultat = service.deverrouiller_commandes(session, actor_id=int(admin_user.user_id))
        nombre_deverrouillees = resultat.get("nombre_deverrouillees", 0)
        session.commit()

        return {
            "nombre_commandes": nombre_deverrouillees,
            "nombre_deverrouillees": nombre_deverrouillees,
            "commandes": resultat.get("commandes", []),
            "statut": "succes",
            "message": f"{nombre_deverrouillees} commande(s) deverrouillee(s).",
        }
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors du deverrouillage JIT: {str(e)}")
    finally:
        session.close()


@router_jit.get("/logs/dernier", response_model=JITLogDTO)
async def get_dernier_log(admin_user=Depends(get_admin_user)):
    """
    Retourne le dernier log d'exécution JIT.
    
    🔒 ADMIN ONLY - Authentification requise
    """
    try:
        session = LocalSession()
        jit_dao = JITDaoBD()
        log = jit_dao.get_last_log(session)
        session.close()
        
        if not log:
            raise HTTPException(status_code=404, detail="Aucun log JIT trouvé")
        
        return log
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")


@router_jit.get("/logs/{date_debut}/{date_fin}")
async def get_logs_par_plage(
    date_debut: str,
    date_fin: str,
    admin_user=Depends(get_admin_user)
):
    """
    Retourne les logs JIT d'une plage de dates.
    Format des dates: YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS
    
    🔒 ADMIN ONLY - Authentification requise
    """
    try:
        session = LocalSession()
        jit_dao = JITDaoBD()
        logs = jit_dao.get_logs_by_date_range(session, date_debut, date_fin)
        session.close()
        
        return {"logs": logs, "nombre": len(logs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")
