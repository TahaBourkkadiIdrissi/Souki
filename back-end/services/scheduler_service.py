"""
Service pour gérer les jobs cron et les tâches planifiées.
Utilise APScheduler pour scheduler le job JIT à 20h00 chaque jour.
"""

import os
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.schedulers.base import SchedulerAlreadyRunningError

from config import LocalSession
from dao.jit_dao import JITDaoBD
from services.jit_service import JITService


scheduler = BackgroundScheduler(daemon=True)


def job_agregation_jit():
    """
    Tâche planifiée pour l'agrégation JIT à 20h00.
    Sera exécutée chaque jour à 20h00 (20:00:00).
    """
    try:
        print(f"\n{'='*80}")
        print(f"🚀 Déclenchement du job JIT d'agrégation à {datetime.now().isoformat()}")
        print(f"{'='*80}\n")
        
        # Créer une session et les dépendances
        session = LocalSession()
        jit_dao = JITDaoBD()
        service = JITService(jit_dao)
        
        # Exécuter le job JIT
        log = service.executer_job_jit(session)
        
        # Fermer la session
        session.close()
        
        print(f"\n{'='*80}")
        print(f"✅ Job JIT terminé. Statut: {log.statut if log else 'ERREUR'}")
        print(f"{'='*80}\n")
        
    except Exception as e:
        print(f"\n{'='*80}")
        print(f"❌ ERREUR lors du job JIT: {str(e)}")
        print(f"{'='*80}\n")


def start_scheduler():
    """
    Démarre le scheduler des jobs cron.
    Met en place le job d'agrégation JIT à 20h00.
    """
    try:
        # Vérifier si le scheduler est déjà en cours d'exécution
        if not scheduler.running:
            # Ajouter le job JIT à 20h00 tous les jours
            # Format: heure (20), minute (0), seconde (0)
            scheduler.add_job(
                job_agregation_jit,
                CronTrigger(hour=20, minute=0, second=0),
                id="jit_agregation_20h00",
                name="Agrégation JIT des commandes à 20h00",
                replace_existing=True,
            )
            
            scheduler.start()
            print("✅ Scheduler de tâches planifiées démarré")
            print(f"   📅 Job JIT configuré à 20h00 chaque jour")
            
    except SchedulerAlreadyRunningError:
        print("⚠️ Scheduler est déjà en cours d'exécution")
    except Exception as e:
        print(f"❌ Erreur lors du démarrage du scheduler: {str(e)}")


def stop_scheduler():
    """Arrête le scheduler"""
    try:
        if scheduler.running:
            scheduler.shutdown()
            print("✅ Scheduler arrêté")
    except Exception as e:
        print(f"❌ Erreur lors de l'arrêt du scheduler: {str(e)}")


def get_scheduler_info():
    """Retourne les informations sur les jobs planifiés"""
    jobs_info = []
    for job in scheduler.get_jobs():
        jobs_info.append({
            "id": job.id,
            "name": job.name,
            "trigger": str(job.trigger),
            "next_run_time": str(job.next_run_time),
        })
    return {
        "scheduler_running": scheduler.running,
        "jobs": jobs_info,
    }
