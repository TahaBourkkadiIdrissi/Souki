"""Fail before accepting traffic when production configuration is incomplete."""
import math
import os


def validate_production_config():
    if os.getenv("SOUKI_ENV", os.getenv("APP_ENV", "development")).lower() not in {"prod", "production"}:
        return
    required = ("DATABASE_URL", "SECRET_KEY", "FRONTEND_ORIGINS", "SOUKI_DEPOT_ADDRESS", "SOUKI_DEPOT_CITY", "SOUKI_DEPOT_PHONE", "SOUKI_DEPOT_LAT", "SOUKI_DEPOT_LNG")
    missing = [key for key in required if not os.getenv(key, "").strip()]
    if missing:
        raise RuntimeError("Configuration de production manquante : " + ", ".join(missing))
    if len(os.environ["SECRET_KEY"]) < 32:
        raise RuntimeError("SECRET_KEY doit contenir au moins 32 caractères aléatoires.")
    if os.getenv("COOKIE_SECURE", "0").lower() not in {"1", "true", "yes"}:
        raise RuntimeError("COOKIE_SECURE=1 est obligatoire en production.")
    for key, limit in (("SOUKI_DEPOT_LAT", 90), ("SOUKI_DEPOT_LNG", 180)):
        try:
            value = float(os.environ[key])
        except ValueError as exc:
            raise RuntimeError(f"{key} doit être une coordonnée valide.") from exc
        if not math.isfinite(value) or not -limit <= value <= limit:
            raise RuntimeError(f"{key} doit être une coordonnée valide.")
    origins = [value.strip() for value in os.environ["FRONTEND_ORIGINS"].split(",")]
    if any(not value.startswith("https://") or "*" in value for value in origins):
        raise RuntimeError("FRONTEND_ORIGINS exige une liste explicite d'origines HTTPS.")
