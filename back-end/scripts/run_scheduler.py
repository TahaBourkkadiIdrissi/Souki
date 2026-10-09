"""Single scheduler process sharing the backend image and configuration."""
import signal
import sys
from pathlib import Path
from threading import Event

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    from services.scheduler_service import start_scheduler, stop_scheduler, job_delivery_cycle
    from production_checks import validate_production_config
    validate_production_config()
    stopped = Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stopped.set())
    start_scheduler()
    # Recover a missed closure when the dedicated process restarts overnight.
    job_delivery_cycle()
    try:
        stopped.wait()
    finally:
        stop_scheduler()


if __name__ == "__main__":
    main()
