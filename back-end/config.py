import os

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import declarative_base, sessionmaker

from env_loader import load_app_env

# Load shared repo env first, then backend-specific overrides.
load_app_env()


def _get_required_env(name: str) -> str:
    value = os.getenv(name)
    if value in (None, ""):
        raise RuntimeError(
            f"Variable d'environnement manquante: {name}. Verifie le fichier back-end/.env."
        )
    return value

# Fetch variables
USER     = os.getenv("user")
PASSWORD = os.getenv("password")
HOST     = os.getenv("host")
PORT     = os.getenv("port")
DBNAME   = os.getenv("dbname")
DB_CONNECT_TIMEOUT = int(os.getenv("DB_CONNECT_TIMEOUT", "5"))

# Construct the SQLAlchemy connection string
DATABASE_URL = os.getenv("DATABASE_URL") or URL.create(
    "postgresql+psycopg2", username=USER, password=PASSWORD, host=HOST,
    port=int(PORT) if PORT else 5432, database=DBNAME,
    query={"sslmode": "require", "connect_timeout": str(DB_CONNECT_TIMEOUT)},
)

# Créer le moteur avec un pool de connexions
# pool_size=10 → max 10 connexions simultanées
# max_overflow=5 → 5 connexions supplémentaires si le pool est plein
# pool_timeout=30 → attendre max 30s avant d'échouer
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=5,
    pool_timeout=30,
    connect_args={"connect_timeout": 5},
    pool_pre_ping=True,
)

# Session locale — à utiliser dans chaque route / service
LocalSession = sessionmaker(bind=engine)

# Base déclarative — tous vos modèles vont hériter de cette classe
Base = declarative_base()


# Security Config
SECRET_KEY = _get_required_env("SECRET_KEY")
ALGORITHM = "HS256"
# Duree reduite de 7 jours a 24 h (VULN-010) ; surchargeable via l'environnement.
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))

# Cookie d'authentification httpOnly (migration depuis le localStorage cote front).
# Le token reste lisible depuis l'en-tete Authorization (retrocompatible), mais il est
# desormais aussi pose dans un cookie httpOnly inaccessible au JavaScript (anti-XSS).
ACCESS_TOKEN_COOKIE_NAME = "access_token"
# secure=True exige HTTPS : on l'active en prod via COOKIE_SECURE=1, desactive en dev (http://localhost).
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "0").lower() in ("1", "true", "yes")
# Lax suffit ici : le front passe par le proxy same-origin /backend, donc le cookie est first-party.
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")


# Dans config.py
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")


def _get_optional_float(name: str):
    value = os.getenv(name)
    if value in (None, ""):
        return None
    try:
        return float(value)
    except ValueError:
        return None


DEFAULT_SOUKI_DEPOT_LAT = 34.0331
DEFAULT_SOUKI_DEPOT_LNG = -5.0003

SOUKI_DEPOT_LAT = _get_optional_float("SOUKI_DEPOT_LAT")
SOUKI_DEPOT_LNG = _get_optional_float("SOUKI_DEPOT_LNG")

if SOUKI_DEPOT_LAT is None:
    SOUKI_DEPOT_LAT = DEFAULT_SOUKI_DEPOT_LAT

if SOUKI_DEPOT_LNG is None:
    SOUKI_DEPOT_LNG = DEFAULT_SOUKI_DEPOT_LNG
