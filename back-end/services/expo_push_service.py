"""Livraison des notifications vers les apps mobiles via le service Expo Push.

L'app (apps/play-store, apps/mobile) envoie son « Expo push token » au
back-end ; Expo relaie ensuite vers FCM (Android, cle FCM V1 du projet EAS) ou
APNs (iOS). Une seule URL sortante, fixe : pas de risque SSRF.
"""

import logging
import os
import re
from dataclasses import dataclass
from typing import Any

import requests

logger = logging.getLogger("souki.push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
# Expo accepte au plus 100 messages par requete.
MAX_MESSAGES_PER_REQUEST = 100
REQUEST_TIMEOUT_SECONDS = 10
# Meme retention que le Web Push : au-dela, l'alerte n'a plus d'interet.
PUSH_TTL_SECONDS = 12 * 3600

EXPO_TOKEN_PATTERN = re.compile(r"^Expo(nent)?PushToken\[[A-Za-z0-9_\-]{10,200}\]$")

# Canaux Android crees par l'app (apps/play-store/src/lib/notifications.ts).
ANDROID_CHANNEL_ORDERS = "commandes"
ANDROID_CHANNEL_ACCOUNT = "compte"
ANDROID_CHANNEL_NEWS = "nouveautes"
_CHANNEL_BY_CATEGORY = {
    "order_updates": ANDROID_CHANNEL_ORDERS,
    "livraison": ANDROID_CHANNEL_ORDERS,
    "promotions": ANDROID_CHANNEL_NEWS,
    "newsletter": ANDROID_CHANNEL_NEWS,
}


def is_valid_expo_token(token: str) -> bool:
    return bool(EXPO_TOKEN_PATTERN.match(token or ""))


def android_channel_for(category: str | None) -> str:
    return _CHANNEL_BY_CATEGORY.get(category or "", ANDROID_CHANNEL_ACCOUNT)


class ExpoPushError(Exception):
    """Echec temporaire (reseau, 5xx, quota) : l'entree outbox sera reessayee."""


@dataclass
class ExpoPushResult:
    delivered: int
    # Jetons d'apps desinstallees (DeviceNotRegistered) : a revoquer.
    gone_tokens: list[str]
    # Erreurs par message autres que DeviceNotRegistered.
    errors: list[str]


class ExpoPushService:
    def __init__(self) -> None:
        # Jeton d'acces Expo : facultatif, requis seulement si « Enhanced Security
        # for Push Notifications » est active sur le projet EAS.
        self.access_token = os.getenv("EXPO_ACCESS_TOKEN", "").strip()

    def send(self, *, tokens: list[str], payload: dict[str, Any], channel_id: str) -> ExpoPushResult:
        result = ExpoPushResult(delivered=0, gone_tokens=[], errors=[])
        valid_tokens = [token for token in tokens if is_valid_expo_token(token)]
        for start in range(0, len(valid_tokens), MAX_MESSAGES_PER_REQUEST):
            chunk = valid_tokens[start:start + MAX_MESSAGES_PER_REQUEST]
            self._send_chunk(chunk, payload, channel_id, result)
        return result

    def _send_chunk(self, tokens: list[str], payload: dict[str, Any], channel_id: str, result: ExpoPushResult) -> None:
        messages = [
            {
                "to": token,
                "title": payload.get("title") or "SOUKI",
                "body": payload.get("body") or "",
                # Lu par l'app au toucher de la notification (ouverture de l'ecran).
                "data": {
                    "url": payload.get("url") or "/",
                    "event": payload.get("event"),
                    **(payload.get("data") or {}),
                },
                "channelId": channel_id,
                "priority": "high" if channel_id == ANDROID_CHANNEL_ORDERS else "default",
                "sound": "default",
                "ttl": PUSH_TTL_SECONDS,
            }
            for token in tokens
        ]
        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
        }
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"

        try:
            response = requests.post(EXPO_PUSH_URL, json=messages, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
        except requests.RequestException as exc:
            raise ExpoPushError(f"Service Expo injoignable ({type(exc).__name__})") from exc

        if response.status_code == 429 or response.status_code >= 500:
            raise ExpoPushError(f"Service Expo indisponible (HTTP {response.status_code})")
        if response.status_code >= 400:
            # Requete refusee (jeton d'acces invalide, format) : reessayer n'y changera rien.
            result.errors.append(f"HTTP {response.status_code}")
            return

        try:
            tickets = response.json().get("data") or []
        except ValueError as exc:
            raise ExpoPushError("Reponse Expo illisible") from exc

        for token, ticket in zip(tokens, tickets):
            if ticket.get("status") == "ok":
                result.delivered += 1
                continue
            error = (ticket.get("details") or {}).get("error") or "inconnue"
            if error == "DeviceNotRegistered":
                result.gone_tokens.append(token)
            else:
                result.errors.append(str(error))


expo_push_service = ExpoPushService()
