import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH)

class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "METTEZ_VOTRE_VRAIE_CLE_ICI")

settings = Settings()

if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "METTEZ_VOTRE_VRAIE_CLE_ICI":
    print("⚠️  ATTENTION : La clé Gemini n'a pas été trouvée dans le fichier .env !")
else:
    print("✅ Clé Gemini chargée avec succès !")
