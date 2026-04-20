import re
import json
import base64
import time
import google.genai as genai
from api.keys import GEMINI_API_KEY

# ── Modèles Gemini (ordre de priorité) ────────────────────────────────────────
MODELS = [
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-2.0-flash-lite",
]

# ── Prompt système SOUKI ──────────────────────────────────────────────────────
SYSTEM_PROMPT = """Tu es l'assistant vocal SOUKI pour un marché au Maroc. Extrais les produits. Réponds UNIQUEMENT avec un JSON valide, sans markdown.
Format exact : {"transcription": "texte", "langue_detectee": "darija|français|mixte", "items": [{"produit_darija": "btata", "produit_fr": "Pommes de terre", "quantite": 2.0, "unite": "kg"}], "produits_non_disponibles": []}

Règles de quantités OBLIGATOIRES (la quantité doit TOUJOURS être un nombre décimal) :
- "nos" ou "noss" = 0.5
- "rab3a" ou "reb3a" = 0.25
- "thelth" ou "tlata" = 0.33
- "un lot", "une botte", "un paquet" = 1.0
- Si on dit juste un chiffre sans unité (ex: "3 tomates") = 3.0
- Convertis TOUTES les quantités en kilogrammes (kg). Exemples : 500g = 0.5, 250g = 0.25, 1kg = 1.0.
- Si le client demande des unités entières (ex: "3 citrons") mais que le produit se vend au kg, mets la quantité estimée en kg (ex: 0.5)."""


def call_gemini(prompt_parts: list) -> dict:
    """
    Appelle l'API Gemini avec fallback + retry.
    NE CRASH JAMAIS.
    """
    client = genai.Client(api_key=GEMINI_API_KEY)

    for model_name in MODELS:
        for attempt in range(3):  #  retry 3 fois
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt_parts
                )

                raw = response.text.strip()  # type: ignore

                # Nettoyage Markdown
                raw = re.sub(r'^```json\s*', '', raw)
                raw = re.sub(r'^```\s*', '', raw)
                raw = re.sub(r'\s*```$', '', raw)

                return json.loads(raw)

            except Exception as e:
                error_str = str(e)
                print(f"[Gemini ERROR] {model_name} (attempt {attempt+1}): {error_str}")

                #  Serveur surchargé → retry
                if "503" in error_str:
                    time.sleep(2)
                    continue

                #  Quota → essayer autre modèle
                if "429" in error_str or "quota" in error_str.lower():
                    break

                #  Permission → stop direct
                if "403" in error_str:
                    return {
                        "transcription": "",
                        "langue_detectee": "unknown",
                        "items": [],
                        "produits_non_disponibles": [],
                        "error": "Access denied (check API key/project)"
                    }

                #  Autre erreur → return safe
                return {
                    "transcription": "",
                    "langue_detectee": "unknown",
                    "items": [],
                    "produits_non_disponibles": [],
                    "error": f"Internal error: {error_str}"
                }

    #  Si tous les modèles échouent
    return {
        "transcription": "",
        "langue_detectee": "unknown",
        "items": [],
        "produits_non_disponibles": [],
        "error": "Gemini unavailable (quota / overload)"
    }


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