import os
from typing import Optional

from fastapi import Request


def _truthy(value: Optional[str]) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _first_ip(raw: str) -> Optional[str]:
    # X-Forwarded-For peut contenir "client, proxy1, proxy2" : le client est en tete.
    candidate = raw.split(",")[0].strip()
    return candidate or None


def extract_client_ip(request: Optional[Request]) -> Optional[str]:
    """Renvoie l'IP du client de facon sure en local comme en prod.

    Strategie (de la plus fiable a la plus generale) :
      1. SOUKI_TRUSTED_IP_HEADER : nom d'un en-tete reecrit par l'hebergeur
         (ex. "CF-Connecting-IP" sur Cloudflare, "X-Real-IP" derriere Nginx).
      2. X-Forwarded-For, uniquement si SOUKI_TRUST_FORWARDED est active
         (a n'activer que derriere un proxy de confiance, sinon falsifiable).
      3. Repli sur l'IP du pair TCP (request.client.host), correct en local.

    Voir CONFIG_IP_SERVEUR.md pour le reglage en production.
    """
    if request is None:
        return None

    trusted_header = os.getenv("SOUKI_TRUSTED_IP_HEADER", "").strip()
    if trusted_header:
        header_value = request.headers.get(trusted_header, "")
        resolved = _first_ip(header_value) if header_value else None
        if resolved:
            return resolved

    if _truthy(os.getenv("SOUKI_TRUST_FORWARDED")):
        forwarded = request.headers.get("x-forwarded-for", "")
        resolved = _first_ip(forwarded) if forwarded else None
        if resolved:
            return resolved

    return request.client.host if request.client else None
