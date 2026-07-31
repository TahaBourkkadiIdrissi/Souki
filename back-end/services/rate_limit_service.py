"""Rate limiting des tentatives de connexion (VULN-009).

Objectifs :
- limiter /auth/login par IP et par identifiant ;
- appliquer une limite plus stricte a /auth/admin/login ;
- stockage partage via Redis si REDIS_URL est configure (plusieurs workers),
  sinon repli sur un stockage memoire process-local ;
- delai progressif apres plusieurs echecs consecutifs ;
- ne jamais reveler si un compte existe (messages generiques) ;
- alerter (log de securite) apres plusieurs echecs administrateur.
"""

import logging
import os
import threading
import time
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger("souki.security")

try:  # pragma: no cover - dependance optionnelle
    import redis as _redis
except ImportError:  # pragma: no cover
    _redis = None


class _MemoryBackend:
    """Stockage process-local (dev / mono-worker). Thread-safe."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._windows: dict[str, list[float]] = {}
        self._values: dict[str, tuple[float, float]] = {}  # key -> (value, expires_at)

    def incr_window(self, key: str, window_seconds: int) -> int:
        now = time.monotonic()
        with self._lock:
            hits = [hit for hit in self._windows.get(key, []) if now - hit < window_seconds]
            hits.append(now)
            self._windows[key] = hits
            return len(hits)

    def count_window(self, key: str, window_seconds: int) -> int:
        now = time.monotonic()
        with self._lock:
            hits = [hit for hit in self._windows.get(key, []) if now - hit < window_seconds]
            self._windows[key] = hits
            return len(hits)

    def clear(self, key: str) -> None:
        with self._lock:
            self._windows.pop(key, None)
            self._values.pop(key, None)

    def set_value(self, key: str, value: float, ttl_seconds: int) -> None:
        with self._lock:
            self._values[key] = (value, time.monotonic() + ttl_seconds)

    def get_value(self, key: str) -> Optional[float]:
        with self._lock:
            entry = self._values.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() >= expires_at:
                self._values.pop(key, None)
                return None
            return value


class _RedisBackend:
    """Stockage partage entre workers/instances (production)."""

    def __init__(self, url: str) -> None:
        if _redis is None:
            raise RuntimeError("Le paquet 'redis' est requis quand REDIS_URL est configure.")
        self._client = _redis.Redis.from_url(url, decode_responses=True)

    def incr_window(self, key: str, window_seconds: int) -> int:
        pipe = self._client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        count, _ = pipe.execute()
        return int(count)

    def count_window(self, key: str, window_seconds: int) -> int:
        _ = window_seconds
        raw = self._client.get(key)
        return int(raw) if raw else 0

    def clear(self, key: str) -> None:
        self._client.delete(key)

    def set_value(self, key: str, value: float, ttl_seconds: int) -> None:
        self._client.set(key, value, ex=ttl_seconds)

    def get_value(self, key: str) -> Optional[float]:
        raw = self._client.get(key)
        return float(raw) if raw is not None else None


def _build_backend():
    redis_url = os.getenv("REDIS_URL", "").strip()
    if redis_url:
        return _RedisBackend(redis_url)

    # Sans Redis, les compteurs sont process-locaux : avec N workers uvicorn,
    # chaque limite (anti-brute-force login ET quotas IA) est de fait multipliee
    # par N, puisque le round-robin repartit les tentatives entre les processus.
    # On le signale fort : c'est silencieux et invisible en production.
    logger.warning(
        "[SECURITE] REDIS_URL absent : rate limiting en memoire, process-local. "
        "Avec plusieurs workers, les limites de connexion et les quotas IA sont "
        "multiplies par le nombre de workers. Configurer REDIS_URL en production."
    )
    return _MemoryBackend()


@dataclass(frozen=True)
class LoginRateLimitPolicy:
    max_attempts_per_ip: int
    max_attempts_per_identifier: int
    window_seconds: int
    # Delai progressif : a partir de `progressive_after` echecs consecutifs,
    # le prochain essai est repousse de base * 2^(echecs - progressive_after).
    progressive_after: int
    progressive_base_seconds: int
    progressive_max_seconds: int
    alert_after_failures: Optional[int] = None


USER_LOGIN_POLICY = LoginRateLimitPolicy(
    max_attempts_per_ip=10,
    max_attempts_per_identifier=5,
    window_seconds=15 * 60,
    progressive_after=3,
    progressive_base_seconds=2,
    progressive_max_seconds=300,
)

# Limite plus stricte pour l'espace administrateur + alerte de securite.
ADMIN_LOGIN_POLICY = LoginRateLimitPolicy(
    max_attempts_per_ip=5,
    max_attempts_per_identifier=3,
    window_seconds=15 * 60,
    progressive_after=2,
    progressive_base_seconds=5,
    progressive_max_seconds=900,
    alert_after_failures=3,
)

RATE_LIMIT_DETAIL = "Trop de tentatives de connexion. Reessayez plus tard."

# VULN-014 : /auth/register et /auth/resend-otp ne sont pas authentifies et
# declenchent chacun un envoi d'email facture (Resend). Le quota par compte ne
# protege rien tant que creer un compte est gratuit et instantane : la limite
# utile est celle par IP, en amont de l'authentification.
SIGNUP_IP_MAX_ATTEMPTS = 5
SIGNUP_IP_WINDOW_SECONDS = 60 * 60
SIGNUP_IP_DETAIL = "Trop de demandes depuis cette connexion. Reessayez plus tard."


class IpActionQuota:
    """Quota par adresse IP pour les routes couteuses ouvertes au public."""

    def __init__(self, backend=None) -> None:
        self._backend = backend or _build_backend()

    def ensure_within_quota(
        self,
        action: str,
        ip: Optional[str],
        max_calls: int,
        window_seconds: int,
        detail: str = SIGNUP_IP_DETAIL,
    ) -> None:
        normalized_ip = (ip or "unknown").strip().lower()
        key = f"souki:ipquota:{action}:{normalized_ip}"
        count = self._backend.incr_window(key, window_seconds)
        if count > max_calls:
            raise HTTPException(
                status_code=429,
                detail=detail,
                headers={"Retry-After": str(window_seconds)},
            )


ip_action_quota = IpActionQuota()


class LoginRateLimiter:
    def __init__(self, backend=None) -> None:
        self._backend = backend or _build_backend()

    @staticmethod
    def _normalize(value: Optional[str]) -> str:
        return (value or "unknown").strip().lower()

    def _key(self, scope: str, kind: str, value: Optional[str]) -> str:
        return f"souki:login:{scope}:{kind}:{self._normalize(value)}"

    def _raise_429(self, retry_after_seconds: int) -> None:
        # Message generique : ne revele ni l'existence d'un compte, ni le compteur.
        raise HTTPException(
            status_code=429,
            detail=RATE_LIMIT_DETAIL,
            headers={"Retry-After": str(max(1, retry_after_seconds))},
        )

    def ensure_can_attempt(
        self,
        scope: str,
        policy: LoginRateLimitPolicy,
        ip: Optional[str],
        identifier: Optional[str],
    ) -> None:
        """Leve HTTP 429 si l'IP ou l'identifiant a depasse sa limite ou est en attente."""
        lock_key = self._key(scope, "lock", identifier)
        locked_until = self._backend.get_value(lock_key)
        if locked_until is not None and time.time() < locked_until:
            self._raise_429(int(locked_until - time.time()) + 1)

        ip_count = self._backend.count_window(self._key(scope, "ip", ip), policy.window_seconds)
        if ip_count >= policy.max_attempts_per_ip:
            self._raise_429(policy.window_seconds)

        id_count = self._backend.count_window(
            self._key(scope, "id", identifier), policy.window_seconds
        )
        if id_count >= policy.max_attempts_per_identifier:
            self._raise_429(policy.window_seconds)

    def register_failure(
        self,
        scope: str,
        policy: LoginRateLimitPolicy,
        ip: Optional[str],
        identifier: Optional[str],
    ) -> None:
        self._backend.incr_window(self._key(scope, "ip", ip), policy.window_seconds)
        failures = self._backend.incr_window(
            self._key(scope, "id", identifier), policy.window_seconds
        )

        if failures >= policy.progressive_after:
            delay = min(
                policy.progressive_base_seconds * (2 ** (failures - policy.progressive_after)),
                policy.progressive_max_seconds,
            )
            self._backend.set_value(
                self._key(scope, "lock", identifier),
                time.time() + delay,
                int(delay) + 1,
            )

        if policy.alert_after_failures is not None and failures >= policy.alert_after_failures:
            # Alerte de securite : brancher ici un canal d'alerte (email/SIEM).
            # On ne journalise ni mot de passe ni identifiant complet.
            logger.warning(
                "[SECURITE] %s echecs de connexion admin consecutifs (ip=%s).",
                failures,
                ip or "inconnue",
            )

    def register_success(self, scope: str, ip: Optional[str], identifier: Optional[str]) -> None:
        _ = ip
        self._backend.clear(self._key(scope, "id", identifier))
        self._backend.clear(self._key(scope, "lock", identifier))


login_rate_limiter = LoginRateLimiter()


# Quota PARTAGE de toutes les generations IA facturees (VULN-008) :
# /api/text-basket et /api/voice-basket (Gemini) et /api/paniers/generer (Groq).
# Un seul compteur pour les trois : sinon un utilisateur cumule les quotas en
# alternant les routes, et chaque route ajoutee rouvre le robinet.
AI_BASKET_QUOTA_ACTION = "ai-basket"
AI_BASKET_QUOTA_MAX_CALLS = 20
AI_BASKET_QUOTA_WINDOW_SECONDS = 60 * 60
AI_BASKET_QUOTA_DETAIL = (
    "Vous avez atteint la limite de generations automatiques pour cette heure. "
    "Composez votre panier manuellement ou reessayez plus tard."
)


class UserActionQuota:
    """Quota generique par utilisateur (ex: appels IA voice/text basket, VULN-008)."""

    def __init__(self, backend=None) -> None:
        self._backend = backend or _build_backend()

    def ensure_within_quota(
        self,
        action: str,
        user_id: int,
        max_calls: int,
        window_seconds: int,
        detail: str = "Quota d'utilisation atteint. Reessayez plus tard.",
    ) -> None:
        key = f"souki:quota:{action}:{int(user_id)}"
        count = self._backend.incr_window(key, window_seconds)
        if count > max_calls:
            raise HTTPException(
                status_code=429,
                detail=detail,
                headers={"Retry-After": str(window_seconds)},
            )


user_action_quota = UserActionQuota()
