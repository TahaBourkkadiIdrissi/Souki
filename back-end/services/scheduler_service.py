"""
Service to manage cron jobs and scheduled tasks.
Uses APScheduler to schedule the JIT, COD alert, and daily dispatch jobs.
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.schedulers.base import SchedulerAlreadyRunningError
from apscheduler.triggers.cron import CronTrigger

from config import LocalSession
from dao.cod_confirmation_log_dao import CODConfirmationLogDaoBD
from dao.commande_dao import CommandeVocaleDaoBD
from dao.jit_dao import JITDaoBD
from dao.livreur_dao import LivreurDaoBD
from dao.tournee_dao import TourneeDaoBD
from dao.zone_jit_dao import ZoneJITDaoBD
from services.dispatch_service import DispatchService
from services.jit_service import JITService


MOROCCO_TIMEZONE = ZoneInfo("Africa/Casablanca")

scheduler = BackgroundScheduler(daemon=True, timezone=MOROCCO_TIMEZONE)
cod_alerte_18h_state = {
    "alerte_active": False,
    "nb_non_confirmees": 0,
    "depuis": None,
}


def job_alerte_cod_18h():
    """
    Scheduled task for COD confirmation alert at 18:00.
    Checks locked COD orders that are not confirmed by phone.
    """
    global cod_alerte_18h_state
    session = None
    try:
        print(f"\n{'=' * 80}")
        print(f"[COD] Verification des confirmations COD a {datetime.now(MOROCCO_TIMEZONE).isoformat()}")
        print(f"{'=' * 80}\n")

        session = LocalSession()
        commande_dao = CommandeVocaleDaoBD()
        cod_log_dao = CODConfirmationLogDaoBD()

        commandes = commande_dao.get_commandes_cod_verrouillees(session)
        latest_logs = cod_log_dao.get_latest_logs_by_commande_ids(
            session,
            [commande["id"] for commande in commandes],
        )
        nb_non_confirmees = sum(
            1
            for commande in commandes
            if str(getattr(latest_logs.get(commande["id"]), "statut", "NON_CONFIRMEE")).upper()
            != "CONFIRMEE_PAR_APPEL"
        )

        cod_alerte_18h_state.update(
            {
                "alerte_active": nb_non_confirmees > 0,
                "nb_non_confirmees": nb_non_confirmees,
                "depuis": datetime.now(MOROCCO_TIMEZONE).isoformat() if nb_non_confirmees > 0 else None,
            }
        )

        print(f"\n{'=' * 80}")
        print(f"[COD] Commandes non confirmees: {nb_non_confirmees}")
        print(f"{'=' * 80}\n")

    except Exception as exc:
        print(f"\n{'=' * 80}")
        print(f"[COD] ERREUR lors du job alerte 18h: {exc}")
        print(f"{'=' * 80}\n")
    finally:
        if session is not None:
            session.close()


def job_agregation_jit():
    """
    Scheduled task for JIT aggregation at 20:00.
    Runs every day at 20:00:00.
    """
    session = None
    try:
        print(f"\n{'=' * 80}")
        print(f"[JIT] Declenchement du job d'agregation a {datetime.now(MOROCCO_TIMEZONE).isoformat()}")
        print(f"{'=' * 80}\n")

        session = LocalSession()
        jit_dao = JITDaoBD()
        zone_dao = ZoneJITDaoBD()
        service = JITService(jit_dao, zone_dao)
        zones_actives = zone_dao.get_zones_actives(session)

        if zones_actives:
            session.close()
            session = None
            resultats = service.executer_job_jit_regional()
            statut = "termine" if resultats else "aucune_zone"
        else:
            log = service.executer_job_jit(session)
            statut = log.statut if log else "ERREUR"

        print(f"\n{'=' * 80}")
        print(f"[JIT] Job termine. Statut: {statut}")
        print(f"{'=' * 80}\n")

    except Exception as exc:
        print(f"\n{'=' * 80}")
        print(f"[JIT] ERREUR lors du job: {exc}")
        print(f"{'=' * 80}\n")
    finally:
        if session is not None:
            session.close()


def job_dispatch_daily():
    """
    Scheduled task for daily dispatch at 21:35 Morocco time.
    Builds tomorrow's delivery routes after the ordering cut-off.
    """
    session = None
    try:
        print(f"\n{'=' * 80}")
        print(f"[DISPATCH] Declenchement du dispatch a {datetime.now(MOROCCO_TIMEZONE).isoformat()}")
        print(f"{'=' * 80}\n")

        session = LocalSession()
        service = DispatchService(
            commande_dao=CommandeVocaleDaoBD(),
            livreur_dao=LivreurDaoBD(),
            tournee_dao=TourneeDaoBD(),
            session=session,
        )
        target_date = datetime.now(MOROCCO_TIMEZONE).date() + timedelta(days=1)
        result = service.generate_daily_routes(target_date)

        print(f"\n{'=' * 80}")
        print(f"[DISPATCH] Job termine. Resultat: {result}")
        print(f"{'=' * 80}\n")

    except Exception as exc:
        if session is not None:
            session.rollback()
        print(f"\n{'=' * 80}")
        print(f"[DISPATCH] ERREUR lors du job: {exc}")
        print(f"{'=' * 80}\n")
    finally:
        if session is not None:
            session.close()


def start_scheduler():
    """
    Start the cron scheduler and register the daily logistics jobs.
    """
    try:
        if not scheduler.running:
            scheduler.add_job(
                job_alerte_cod_18h,
                CronTrigger(hour=18, minute=0, second=0, timezone=MOROCCO_TIMEZONE),
                id="cod_alerte_18h00",
                name="Alerte COD non confirmees a 18h00",
                replace_existing=True,
            )
            scheduler.add_job(
                job_agregation_jit,
                CronTrigger(hour=20, minute=0, second=0, timezone=MOROCCO_TIMEZONE),
                id="jit_agregation_20h00",
                name="Agregation JIT des commandes a 20h00",
                replace_existing=True,
            )
            scheduler.add_job(
                job_dispatch_daily,
                CronTrigger(hour=21, minute=35, second=0, timezone=MOROCCO_TIMEZONE),
                id="dispatch_daily_21h35",
                name="Generation automatique des tournees a 21h35",
                replace_existing=True,
            )

            scheduler.start()
            print("[SCHEDULER] Scheduler demarre")
            print("[SCHEDULER] Job alerte COD configure a 18h00 chaque jour")
            print("[SCHEDULER] Job JIT configure a 20h00 chaque jour")
            print("[SCHEDULER] Job dispatch configure a 21h35 chaque jour")

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
