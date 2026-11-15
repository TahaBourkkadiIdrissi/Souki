"""Verification des identity tokens « Sign in with Apple » (app iOS).

L'identity token est un JWT RS256 signe par Apple. On verifie, comme pour Google :
- la signature avec les cles publiques d'Apple (https://appleid.apple.com/auth/keys) ;
- l'emetteur (https://appleid.apple.com) et le destinataire (bundle de l'app, APPLE_CLIENT_IDS) ;
- l'expiration ;
- un e-mail present et verifie (adresse relais @privaterelay.appleid.com comprise).
Aucun secret n'est necessaire : seules les cles publiques d'Apple servent.
"""

import logging
import threading
import time
from typing import Optional

import requests
from fastapi import HTTPException
from jose import jwk, jwt
from jose.exceptions import JWTError

from config import APPLE_CLIENT_IDS

logger = logging.getLogger(__name__)

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
_KEYS_TTL_SECONDS = 6 * 60 * 60

_keys_lock = threading.Lock()
_keys_cache: dict = {"keys": [], "fetched_at": 0.0}


def _fetch_apple_keys(force: bool = False) -> list[dict]:
    with _keys_lock:
        fresh = time.monotonic() - _keys_cache["fetched_at"] < _KEYS_TTL_SECONDS
        if _keys_cache["keys"] and fresh and not force:
            return _keys_cache["keys"]
        try:
            response = requests.get(APPLE_KEYS_URL, timeout=5)
            response.raise_for_status()
            keys = response.json().get("keys") or []
        except (requests.RequestException, ValueError) as exc:
            if _keys_cache["keys"]:
                # Apple injoignable : on garde les cles deja connues.
                logger.warning("Cles Apple indisponibles, cache conserve : %s", exc)
                return _keys_cache["keys"]
            raise HTTPException(status_code=503, detail="La validation Apple est temporairement indisponible.") from exc
        _keys_cache["keys"] = keys
        _keys_cache["fetched_at"] = time.monotonic()
        return keys


def _key_for(kid: str) -> Optional[dict]:
    for force in (False, True):
        # Cle inconnue : Apple a peut-etre tourne ses cles, on relit une fois.
        key = next((k for k in _fetch_apple_keys(force=force) if k.get("kid") == kid), None)
        if key:
            return key
    return None


def _is_true(value) -> bool:
    return value is True or (isinstance(value, str) and value.lower() == "true")


def verify_apple_identity_token(identity_token: str) -> Optional[dict]:
    """Renvoie {sub, email} si le jeton est valide, sinon None (503 si Apple est injoignable)."""
    if not APPLE_CLIENT_IDS:
        raise HTTPException(status_code=503, detail="La connexion Apple n'est pas configurée sur le serveur.")
    try:
        header = jwt.get_unverified_header(identity_token)
    except JWTError:
        return None
    if header.get("alg") != "RS256" or not header.get("kid"):
        return None

    key_data = _key_for(header["kid"])
    if not key_data:
        return None

    try:
        public_key = jwk.construct(key_data, algorithm="RS256")
        claims = jwt.decode(
            identity_token,
            public_key,
            algorithms=["RS256"],
            issuer=APPLE_ISSUER,
            # python-jose n'accepte qu'un destinataire : verifie ci-dessous parmi APPLE_CLIENT_IDS.
            options={"verify_aud": False, "verify_at_hash": False},
        )
    except (JWTError, ValueError):
        return None

    audiences = claims.get("aud")
    audiences = [audiences] if isinstance(audiences, str) else list(audiences or [])
    if not any(aud in APPLE_CLIENT_IDS for aud in audiences):
        return None

    sub = claims.get("sub")
    email = claims.get("email")
    if not isinstance(sub, str) or not sub:
        return None
    if not isinstance(email, str) or not email.strip() or not _is_true(claims.get("email_verified")):
        return None
    return {"sub": sub, "email": email.strip().casefold()}
