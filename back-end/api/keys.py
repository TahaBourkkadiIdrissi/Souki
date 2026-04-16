import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

# Validation
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY non trouvée dans les variables d'environnement")

if not GOOGLE_CLIENT_ID:
   raise ValueError("GOOGLE_CLIENT_ID non trouvée dans les variables d'environnement")
