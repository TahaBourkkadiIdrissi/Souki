import os
from dotenv import load_dotenv

load_dotenv()

# ── Clé Google Gemini ──────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# ── Clé Google OAuth (login Google) ───────────────────────────────────────────
GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

# ── Clé JWT ───────────────────────────────────────────────────────────────────
SECRET_KEY: str = os.getenv("SECRET_KEY", "VOTRE_CLE_SECRETE")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 jours
