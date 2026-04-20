import os

from env_loader import load_app_env

load_app_env()

class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "METTEZ_VOTRE_VRAIE_CLE_ICI")

settings = Settings()

if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "METTEZ_VOTRE_VRAIE_CLE_ICI":
    print("⚠️  ATTENTION : La clé Gemini n'a pas été trouvée dans le fichier .env !")
else:
    print("✅ Clé Gemini chargée avec succès !")
