import os

from env_loader import load_app_env

load_app_env()

# ── Clé Google Gemini ──────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# ── Clé Google OAuth (login Google) ───────────────────────────────────────────
GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

# ── Clé JWT ───────────────────────────────────────────────────────────────────
# La configuration JWT vit dans config.py et NULLE PART AILLEURS. Ce module
# declarait un doublon avec ACCESS_TOKEN_EXPIRE_MINUTES = 7 jours, en
# contradiction avec les 24 h de config.py : personne ne l'importait, mais le
# premier import aurait triple la duree de vie des tokens sans que rien ne le
# signale. Utiliser `from config import SECRET_KEY, ALGORITHM, ...`.

# ── Clé Google Gemini pour generation de panier ──────────────────────────────────────────────────────────
GEMINI_API_KEY_GPA: str = os.getenv("GEMINI_API_KEY_GPA", "")
