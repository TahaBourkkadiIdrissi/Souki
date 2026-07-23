import ipaddress
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

MAX_ENDPOINT_LENGTH = 500

# Le backend fait une requete sortante vers cet endpoint : un endpoint pointant
# vers le reseau interne transformerait l'API en relais SSRF. On refuse donc
# tout ce qui n'est pas un hote public en HTTPS.
_BLOCKED_HOST_SUFFIXES = (".local", ".internal", ".localdomain")
_BLOCKED_HOSTS = {"localhost", "metadata.google.internal"}


def validate_push_endpoint(value: str) -> str:
    endpoint = (value or "").strip()
    if not endpoint:
        raise ValueError("Endpoint push manquant")
    if len(endpoint) > MAX_ENDPOINT_LENGTH:
        raise ValueError("Endpoint push trop long")

    parsed = urlparse(endpoint)
    if parsed.scheme != "https":
        raise ValueError("Endpoint push invalide (HTTPS requis)")

    host = (parsed.hostname or "").lower()
    if not host or host in _BLOCKED_HOSTS or host.endswith(_BLOCKED_HOST_SUFFIXES):
        raise ValueError("Endpoint push invalide")

    try:
        ipaddress.ip_address(host)
    except ValueError:
        # Nom de domaine : cas normal (fcm.googleapis.com, web.push.apple.com...).
        return endpoint

    # Une IP litterale n'est jamais un service de push de navigateur legitime.
    raise ValueError("Endpoint push invalide")


class PushSubscriptionKeysDTO(BaseModel):
    p256dh: str = Field(min_length=1, max_length=255)
    auth: str = Field(min_length=1, max_length=255)


class PushSubscriptionDTO(BaseModel):
    """Serialisation d'un `PushSubscription` du navigateur (subscription.toJSON())."""

    endpoint: str
    keys: PushSubscriptionKeysDTO

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value: str) -> str:
        return validate_push_endpoint(value)


class PushUnsubscribeDTO(BaseModel):
    endpoint: str

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value: str) -> str:
        return validate_push_endpoint(value)
