import os
from pathlib import Path

from dotenv import dotenv_values


BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent


def load_app_env() -> None:
    """Local defaults only; injected deployment/test variables always win."""
    if os.getenv("SOUKI_LOAD_ENV_FILES", "1").lower() in {"0", "false", "no"}:
        return
    merged_env: dict[str, str] = {}

    for env_path in (REPO_ROOT / ".env", BASE_DIR / ".env"):
        if not env_path.exists():
            continue

        for key, value in dotenv_values(env_path).items():
            if value is not None:
                merged_env[key] = value

    for key, value in merged_env.items():
        os.environ.setdefault(key, value)
