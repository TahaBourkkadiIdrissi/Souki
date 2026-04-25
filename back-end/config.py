import os

from sqlalchemy import create_engine
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
USER = _get_required_env("user")
PASSWORD = _get_required_env("password")
HOST = _get_required_env("host")
PORT = _get_required_env("port")
DBNAME = _get_required_env("dbname")

# Construct the SQLAlchemy connection string
DATABASE_URL = f"postgresql+psycopg2://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}?sslmode=require"

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
)

# Session locale — à utiliser dans chaque route / service
LocalSession = sessionmaker(bind=engine)

# Base déclarative — tous vos modèles vont hériter de cette classe
Base = declarative_base()


# Security Config
SECRET_KEY = "VOTRE_CLE_REELLEMENT_SECRETE_POUR_FES" # À mettre en variable d'env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 jours


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
