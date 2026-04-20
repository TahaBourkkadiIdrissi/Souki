from fastapi import APIRouter, Depends, HTTPException
import os

from config import LocalSession
from controllers.auth_controller import get_current_user
from dao.jit_dao import JITDaoBD
from services.jit_service import JITService
from dto.jit_dto import ResultatAgregationJIT, JITLogDTO


router_jit = APIRouter(prefix="/api/jit", tags=["JIT-Aggregation"])


def get_admin_user(user=Depends(get_current_user)):
    """
    Dépendance pour vérifier que l'utilisateur est ADMIN.
    Leève une exception 403 si ce n'est pas un admin.
    """
    # user est le payload JWT: {"sub": user_id, "role": "ADMIN", ...}
    if not user or user.get("role") != "ADMIN":
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
    Exécute le job JIT complet:
    1. Agrège les commandes
    2. Verrouille les commandes
    3. Envoie la liste d'achats par email
    4. Crée un log

    ⚠️ À NE DÉCLENCHER QU'À 20h00
    🔒 ADMIN ONLY - Authentification requise
    """
    try:
        session = LocalSession()
        
        # Récupérer l'email du fondateur depuis les variables d'environnement
        email_fondateur = os.getenv("FONDATEUR_EMAIL", "admin@souki.ma")
        
        log = service.executer_job_jit(session, email_fondateur)
        # ❌ ENLEVER session.commit() - Le Service le fait déjà!
        session.close()
        
        if not log:
            raise HTTPException(status_code=500, detail="Impossible de créer le log JIT")
        
        return log
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'exécution JIT: {str(e)}")


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
