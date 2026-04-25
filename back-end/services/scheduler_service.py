"""
Service to manage cron jobs and scheduled tasks.
Uses APScheduler to schedule the JIT job every day at 20:00.
"""

from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.schedulers.base import SchedulerAlreadyRunningError
from apscheduler.triggers.cron import CronTrigger

from config import LocalSession
from dao.jit_dao import JITDaoBD
from services.jit_service import JITService


scheduler = BackgroundScheduler(daemon=True)


def job_agregation_jit():
    """
    Scheduled task for JIT aggregation at 20:00.
    Runs every day at 20:00:00.
    """
    try:
        print(f"\n{'=' * 80}")
        print(f"[JIT] Declenchement du job d'agregation a {datetime.now().isoformat()}")
        print(f"{'=' * 80}\n")

        session = LocalSession()
        jit_dao = JITDaoBD()
        service = JITService(jit_dao)

        log = service.executer_job_jit(session)
        session.close()

        print(f"\n{'=' * 80}")
        print(f"[JIT] Job termine. Statut: {log.statut if log else 'ERREUR'}")
        print(f"{'=' * 80}\n")

    except Exception as exc:
        print(f"\n{'=' * 80}")
        print(f"[JIT] ERREUR lors du job: {exc}")
        print(f"{'=' * 80}\n")


def start_scheduler():
    """
    Start the cron scheduler and register the 20:00 JIT job.
    """
    try:
        if not scheduler.running:
            scheduler.add_job(
                job_agregation_jit,
                CronTrigger(hour=20, minute=0, second=0),
                id="jit_agregation_20h00",
                name="Agregation JIT des commandes a 20h00",
                replace_existing=True,
            )

            scheduler.start()
            print("[SCHEDULER] Scheduler demarre")
            print("[SCHEDULER] Job JIT configure a 20h00 chaque jour")

    except SchedulerAlreadyRunningError:
        print("[SCHEDULER] Scheduler deja en cours d'execution")
    except Exception as exc:
        print(f"[SCHEDULER] Erreur lors du demarrage du scheduler: {exc}")


def stop_scheduler():
    """Stop the scheduler."""
    try:
        if scheduler.running:
            scheduler.shutdown()
            print("[SCHEDULER] Scheduler arrete")
    except Exception as exc:
        print(f"[SCHEDULER] Erreur lors de l'arret du scheduler: {exc}")


def get_scheduler_info():
    """Return information about scheduled jobs."""
    jobs_info = []
    for job in scheduler.get_jobs():
        jobs_info.append(
            {
                "id": job.id,
                "name": job.name,
                "trigger": str(job.trigger),
                "next_run_time": str(job.next_run_time),
            }
        )
    return {
        "scheduler_running": scheduler.running,
        "jobs": jobs_info,
    }
