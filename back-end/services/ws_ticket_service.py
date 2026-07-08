"""Tickets WebSocket opaques a usage unique (VULN-007).

Le JWT principal ne transite plus jamais dans la query string du WebSocket :
le client obtient d'abord un ticket opaque via un endpoint HTTP protege
(authentification + permissions + session active verifiees), puis ouvre le
WebSocket avec ce ticket. Le ticket :
- expire au bout de 30 secondes ;
- n'est utilisable qu'une seule fois ;
- est lie a l'utilisateur ET a la session qui l'ont emis (une session revoquee
  entre l'emission et la connexion invalide le ticket).
"""

import hashlib
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Optional

WS_TICKET_TTL_SECONDS = 30


@dataclass(frozen=True)
class WsTicketClaims:
    user_id: int
    session_id: Optional[int]


class WsTicketService:
    def __init__(self, ttl_seconds: int = WS_TICKET_TTL_SECONDS) -> None:
        self._ttl_seconds = ttl_seconds
        self._lock = threading.Lock()
        self._tickets: dict[str, tuple[WsTicketClaims, float]] = {}

    @staticmethod
    def _hash(ticket: str) -> str:
        # Seule l'empreinte est stockee : un dump memoire/log ne revele pas le ticket.
        return hashlib.sha256(ticket.encode("utf-8")).hexdigest()

    def _purge_expired(self, now: float) -> None:
        expired = [key for key, (_, expires_at) in self._tickets.items() if now >= expires_at]
        for key in expired:
            self._tickets.pop(key, None)

    def issue_ticket(self, user_id: int, session_id: Optional[int]) -> str:
        ticket = secrets.token_urlsafe(32)
        now = time.monotonic()
        with self._lock:
            self._purge_expired(now)
            self._tickets[self._hash(ticket)] = (
                WsTicketClaims(user_id=int(user_id), session_id=session_id),
                now + self._ttl_seconds,
            )
        return ticket

    def consume_ticket(self, ticket: str) -> Optional[WsTicketClaims]:
        """Retourne les claims du ticket puis l'invalide (usage unique)."""
        if not ticket:
            return None
        now = time.monotonic()
        with self._lock:
            self._purge_expired(now)
            entry = self._tickets.pop(self._hash(ticket), None)
        if entry is None:
            return None
        claims, expires_at = entry
        if now >= expires_at:
            return None
        return claims


ws_ticket_service = WsTicketService()
