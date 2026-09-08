"""Unit tests with fake credentials and no loading of developer secrets."""
import os
from pathlib import Path
import subprocess
import sys

def main():
    env = dict(os.environ)
    env.update({
        "SOUKI_LOAD_ENV_FILES": "0", "SOUKI_ENV": "test",
        "SECRET_KEY": "test-only-not-a-production-secret",
        "DATABASE_URL": "postgresql+psycopg2://test:test@127.0.0.1:1/test",
        "SOUKI_SKIP_DB_INIT": "1", "SOUKI_ENABLE_SCHEDULER": "0",
        # Legacy fixtures test retained supplier/stock behavior; operating-mode
        # tests override these flags and cover the active release explicitly.
        "SOUKI_ENABLE_SUPPLIERS": "1", "SOUKI_PREORDERS": "0",
        "REDIS_URL": "", "FRONTEND_ORIGINS": "",
    })
    return subprocess.call([sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"], cwd=Path(__file__).resolve().parents[1], env=env)

if __name__ == "__main__":
    raise SystemExit(main())
