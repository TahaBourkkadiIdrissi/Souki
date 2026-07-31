import ipaddress
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

MAX_ENDPOINT_LENGTH = 500

# Le backend fait une requete sortante vers cet endpoint : un endpoint pointant
# vers le reseau interne transformerait l'API en relais SSRF.
#
# Une liste noire ne suffit pas : un nom de domaine public qui RESOUT vers une
# adresse privee (rebinding DNS, 169-254-169-254.nip.io...) la traverse sans
# probleme. Les services de push de navigateur sont en nombre fini et connus, on
# passe donc a une liste blanche — tout le reste est refuse par defaut.
_ALLOWED_HOST_SUFFIXES = (
    ".googleapis.com",          # Chrome / Edge / Android (FCM)
    ".push.services.mozilla.com",  # Firefox
    ".notify.windows.com",      # Windows / Edge legacy (WNS)
    ".push.apple.com",          # Safari / iOS
)
_ALLOWED_HOSTS = {
    "fcm.googleapis.com",
    "updates.push.services.mozilla.com",
    "web.push.apple.com",
}


def validate_push_endpoint(value: str) -> str:
    endpoint = (value or "").strip()
    if not endpoint:
        raise ValueError("Endpoint push manquant")
    if len(endpoint) > MAX_ENDPOINT_LENGTH:
        raise ValueError("Endpoint push trop long")

    parsed = urlparse(endpoint)
    if parsed.scheme != "https":
        raise ValueError("Endpoint push invalide (HTTPS requis)")

    host = (parsed.hostname or "").lower().rstrip(".")
    if not host:
        raise ValueError("Endpoint push invalide")

    # Une IP litterale n'est jamais un service de push de navigateur legitime
    # (et ne pourrait de toute facon pas figurer dans la liste blanche).
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ValueError("Endpoint push invalide")

    if host in _ALLOWED_HOSTS or host.endswith(_ALLOWED_HOST_SUFFIXES):
        return endpoint

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
