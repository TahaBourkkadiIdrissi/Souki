<<<<<<< HEAD
import os
from dotenv import load_dotenv
=======
>>>>>>> main
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

<<<<<<< HEAD
load_dotenv()
# Database Config
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "00%2B9ALAS")
DB_NAME = os.getenv("DB_NAME", "db_souki")
DB_PORT = os.getenv("DB_PORT", "5432")
=======
# Load environment variables from .env
load_dotenv()
>>>>>>> main

# Fetch variables
USER     = os.getenv("user")
PASSWORD = os.getenv("password")
HOST     = os.getenv("host")
PORT     = os.getenv("port")
DBNAME   = os.getenv("dbname")

# Construct the SQLAlchemy connection string
DATABASE_URL = f"postgresql+psycopg2://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}?sslmode=require"

<<<<<<< HEAD
engine = create_engine(URL, pool_size=10, pool_pre_ping=True) 
LocalSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
=======
# Créer le moteur avec un pool de connexions
# pool_size=10 → max 10 connexions simultanées
# max_overflow=5 → 5 connexions supplémentaires si le pool est plein
# pool_timeout=30 → attendre max 30s avant d'échouer
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=5,
    pool_timeout=30,
)

# Session locale — à utiliser dans chaque route / service
LocalSession = sessionmaker(bind=engine)

# Base déclarative — tous vos modèles vont hériter de cette classe
>>>>>>> main
Base = declarative_base()


# Security Config
SECRET_KEY = "VOTRE_CLE_REELLEMENT_SECRETE_POUR_FES" # À mettre en variable d'env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 jours