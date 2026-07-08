"""Exceptions metier typees et journalisation correlee (RISK-002 / BUG-005).

Regles :
- le texte brut d'une exception interne (SQL, stacktrace, detail technique)
  n'est JAMAIS renvoye au client ;
- les erreurs internes sont journalisees avec un identifiant de correlation,
  renvoye au client dans un message public generique pour faciliter le support ;
- les erreurs metier previsibles utilisent des exceptions typees avec un
  message public sur.
"""

import logging
import uuid

from fastapi import HTTPException

logger = logging.getLogger("souki.errors")

GENERIC_ERROR_MESSAGE = "Une erreur interne est survenue. Reessayez ou contactez le support."


class BusinessError(Exception):
    """Erreur metier previsible : son message est destine au client."""

    status_code = 400

    def __init__(self, public_message: str, status_code: int | None = None) -> None:
        super().__init__(public_message)
        self.public_message = public_message
        if status_code is not None:
            self.status_code = status_code

    def to_http(self) -> HTTPException:
        return HTTPException(status_code=self.status_code, detail=self.public_message)


class ResourceNotFoundError(BusinessError):
    status_code = 404


class BusinessRuleViolationError(BusinessError):
    status_code = 409


def log_internal_error(context: str, exc: Exception) -> str:
    """Journalise l'exception complete cote serveur et retourne l'id de correlation."""
    correlation_id = uuid.uuid4().hex[:12]
    logger.exception(
        "[%s] %s (correlation_id=%s)", context, type(exc).__name__, correlation_id
    )
    return correlation_id


def internal_error_http(context: str, exc: Exception) -> HTTPException:
    """Construit la reponse 500 publique (generique) apres journalisation correlee."""
    correlation_id = log_internal_error(context, exc)
    return HTTPException(
        status_code=500,
        detail=f"{GENERIC_ERROR_MESSAGE} (ref: {correlation_id})",
    )
