import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()


class Settings:
    """Paramètres de l'application"""
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://user:password@host:port/dbname"
    )
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "VOTRE_CLE_REELLEMENT_SECRETE_POUR_FES")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 jours
    
    # APIs
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    
    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    RELOAD: bool = os.getenv("RELOAD", "True").lower() == "true"
    
    # Frontend
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")


settings = Settings()

# Validation des clés requises
if not settings.GEMINI_API_KEY:
    print("⚠️ ATTENTION : GEMINI_API_KEY non trouvée dans .env")

if not settings.GOOGLE_CLIENT_ID:
    print("⚠️ ATTENTION : GOOGLE_CLIENT_ID non trouvée dans .env")
