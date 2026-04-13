import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Database Config
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "hamza")
DB_NAME = os.getenv("DB_NAME", "db_souki")
DB_PORT = os.getenv("DB_PORT", "5432")


URL:str = 'postgresql+psycopg2://' + DB_USER + ':' + DB_PASSWORD + '@localhost:' + DB_PORT + '/' + DB_NAME

engine = create_engine(URL, pool_size=10)
LocalSession = sessionmaker(bind=engine)
Base = declarative_base()

# Security Config
SECRET_KEY = "VOTRE_CLE_REELLEMENT_SECRETE_POUR_FES" # À mettre en variable d'env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 jours