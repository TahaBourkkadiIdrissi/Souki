import os

from env_loader import load_app_env

load_app_env()

# ── Clé Google Gemini ──────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# ── Clé Google OAuth (login Google) ───────────────────────────────────────────
GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

# ── Clé JWT ───────────────────────────────────────────────────────────────────
SECRET_KEY: str = os.environ["SECRET_KEY"]
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 jours

# ── Clé Google Gemini pour generation de panier ──────────────────────────────────────────────────────────
GEMINI_API_KEY_GPA: str = os.getenv("GEMINI_API_KEY_GPA", "")
