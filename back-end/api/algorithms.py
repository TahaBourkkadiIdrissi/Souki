import google.genai as genai
from typing import Optional
from api.keys import GEMINI_API_KEY

# Prompt système
SYSTEM_PROMPT = """Tu es l'assistant vocal SOUKI. Extrais les produits. Réponds UNIQUEMENT avec un JSON valide, sans markdown.
Format exact : {"transcription": "texte", "langue_detectee": "darija|français|mixte", "items": [{"produit_darija": "btata", "produit_fr": "Pommes de terre", "quantite": 2.0, "unite": "kg"}], "produits_non_disponibles": []}
Règles: "nos" ou "noss" = 0.5. Si pas de quantité = 1."""

MODELS = [
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-2.0-flash-lite"
]


def _call_gemini(input_data: str, mime_type: Optional[str] = None, is_text: bool = False) -> Optional[str]:
    """
    Appelle l'API Gemini pour traiter du texte ou de l'audio
    
    Args:
        input_data: Le texte ou l'audio en base64
        mime_type: Type MIME de l'audio (ex: "audio/webm", "audio/mp3")
        is_text: Si True, input_data est du texte; sinon c'est de l'audio
    
    Returns:
        La réponse de Gemini en JSON string
    """
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        model = MODELS[0]  # models/gemini-2.5-flash

        if is_text:
            # Traiter du texte
            response = client.models.generate_content(
                model=model,
                contents=[
                    {"role": "user", "parts": [
                        {"text": SYSTEM_PROMPT},
                        {"text": f"Transcription: {input_data}"}
                    ]}
                ]
            )
        else:
            # Traiter de l'audio en base64
            response = client.models.generate_content(
                model=model,
                contents=[
                    {"role": "user", "parts": [
                        {"text": SYSTEM_PROMPT},
                        {
                            "inline_data": {
                                "mime_type": mime_type or "audio/webm",
                                "data": input_data
                            }
                        }
                    ]}
                ]
            )

        if response and response.text:
            return response.text

        return None

    except Exception as e:
        print(f"Erreur Gemini API: {e}")
        return None
