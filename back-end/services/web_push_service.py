"""Livraison Web Push (VAPID / RFC 8291) vers les navigateurs abonnes."""

import json
import logging
import os
from typing import Any

logger = logging.getLogger("souki.push")

# Duree de retention du message par le service de push si l'appareil est hors
# ligne. 12 h : au-dela, une alerte de livraison n'a plus d'interet.
PUSH_TTL_SECONDS = 12 * 3600


class WebPushError(Exception):
    """Echec temporaire d'envoi : l'entree outbox sera reessayee."""


class PushSubscriptionGone(Exception):
    """Le service de push a repondu 404/410 : l'abonnement doit etre revoque."""


class WebPushService:
    def __init__(self) -> None:
        self.public_key = os.getenv("VAPID_PUBLIC_KEY", "").strip()
        self.private_key = os.getenv("VAPID_PRIVATE_KEY", "").strip()
        # `sub` de la claim VAPID : contact joignable par l'operateur du service
        # de push en cas d'abus (obligatoire, doit etre mailto: ou https:).
        self.subject = os.getenv("VAPID_SUBJECT", "mailto:support@souki.app").strip()

    def is_configured(self) -> bool:
        return bool(self.public_key and self.private_key)

    def get_public_key(self) -> str:
        return self.public_key

    def send(self, *, endpoint: str, p256dh: str, auth: str, payload: dict[str, Any]) -> None:
        if not self.is_configured():
            raise WebPushError("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY manquants dans back-end/.env")

        # Import tardif : l'application doit demarrer meme si pywebpush n'est pas
        # installe (le canal PUSH est alors simplement indisponible).
        try:
            from pywebpush import WebPushException, webpush
        except ImportError as exc:
            raise WebPushError("pywebpush n'est pas installe (pip install -r requirements.txt)") from exc

        try:
            webpush(
                subscription_info={
                    "endpoint": endpoint,
                    "keys": {"p256dh": p256dh, "auth": auth},
                },
                data=json.dumps(payload, ensure_ascii=False),
                vapid_private_key=self.private_key,
                vapid_claims={"sub": self.subject},
                ttl=PUSH_TTL_SECONDS,
            )
        except WebPushException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            # 404 : endpoint inconnu. 410 Gone : desinscription cote navigateur.
            # Dans les deux cas re-essayer est inutile et couteux.
            if status_code in (404, 410):
                raise PushSubscriptionGone(f"Abonnement push expire (HTTP {status_code})") from exc
            raise WebPushError(f"Echec d'envoi push (HTTP {status_code or '?'})") from exc
        except Exception as exc:
            raise WebPushError(f"Echec d'envoi push ({type(exc).__name__})") from exc


web_push_service = WebPushService()
