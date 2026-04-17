import re
import json
import base64
import google.genai as genai
from api.keys import GEMINI_API_KEY

# ── Modèles Gemini (ordre de priorité) ────────────────────────────────────────
MODELS = [
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-2.0-flash-lite",
]

# ── Prompt système SOUKI ──────────────────────────────────────────────────────
SYSTEM_PROMPT = """Tu es l'assistant vocal SOUKI. Extrais les produits. Réponds UNIQUEMENT avec un JSON valide, sans markdown.
Format exact : {"transcription": "texte", "langue_detectee": "darija|français|mixte", "items": [{"produit_darija": "btata", "produit_fr": "Pommes de terre", "quantite": 2.0, "unite": "kg"}], "produits_non_disponibles": []}
Règles: "nos" ou "noss" = 0.5. Si pas de quantité = 1."""


def call_gemini(prompt_parts: list) -> dict:
    """
    Appelle l'API Gemini avec fallback sur plusieurs modèles.
    Retourne un dict JSON parsé.
    """
    client = genai.Client(api_key=GEMINI_API_KEY)
    last_error = None

    for model_name in MODELS:
        try:
            response = client.models.generate_content(
                model=model_name, contents=prompt_parts
            )
            raw = response.text.strip()
            raw = re.sub(r'^```json\s*', '', raw)
            raw = re.sub(r'^```\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
            return json.loads(raw)
        except Exception as e:
            last_error = e
            if "429" not in str(e) and "quota" not in str(e).lower():
                raise e

    raise last_error


def build_audio_parts(audio_b64: str, mime_type: str) -> list:
    """Construit les parts Gemini pour un audio base64."""
    from google.genai import types
    audio_part = types.Part.from_bytes(
        data=base64.b64decode(audio_b64),
        mime_type=mime_type
    )
    return [
        SYSTEM_PROMPT,
        audio_part,
        "Analyse cette commande vocale et retourne le JSON structuré."
    ]


def build_text_parts(texte: str) -> list:
    """Construit les parts Gemini pour un texte."""
    return [
        SYSTEM_PROMPT,
        f"Commande client : \"{texte}\"\n\nRetourne le JSON structuré."
    ]
