import os
from dotenv import load_dotenv

# 1. On trouve le chemin absolu du dossier où se trouve ce fichier
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

# 2. On force le chargement du fichier .env exact
load_dotenv(ENV_PATH)

class Settings:
    # 3. On lit la clé. 
    # ASTUCE : Si le .env ne marche toujours pas, remplacez le "None" par votre vraie clé entre guillemets pour tester !
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "METTEZ_VOTRE_VRAIE_CLE_ICI_POUR_VOUS_DEBLOQUER")

settings = Settings()

# Petite vérification dans le terminal pour vous aider à débugger
if settings.GEMINI_API_KEY == "METTEZ_VOTRE_VRAIE_CLE_ICI_POUR_VOUS_DEBLOQUER" or not settings.GEMINI_API_KEY:
    print("⚠️ ATTENTION : La clé Gemini n'a pas été trouvée dans le fichier .env !")
else:
    print("✅ Clé Gemini chargée avec succès !")