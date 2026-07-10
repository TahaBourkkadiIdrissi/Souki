"""HAMZA-02 / VULN-009 : rate limiting des connexions et quotas IA."""

import unittest

from fastapi import HTTPException

from services.rate_limit_service import (
    ADMIN_LOGIN_POLICY,
    RATE_LIMIT_DETAIL,
    USER_LOGIN_POLICY,
    LoginRateLimiter,
    UserActionQuota,
    _MemoryBackend,
)

IP = "196.200.1.10"
IDENTIFIER = "client@example.ma"


def _fail_n_times(limiter, scope, policy, count, ip=IP, identifier=IDENTIFIER):
    for _ in range(count):
        limiter.register_failure(scope, policy, ip, identifier)


class LoginRateLimiterTests(unittest.TestCase):
    def setUp(self):
        self.limiter = LoginRateLimiter(backend=_MemoryBackend())

    def test_depassement_de_la_limite_par_identifiant_renvoie_429(self):
        _fail_n_times(self.limiter, "user", USER_LOGIN_POLICY, USER_LOGIN_POLICY.max_attempts_per_identifier)

        with self.assertRaises(HTTPException) as ctx:
            self.limiter.ensure_can_attempt("user", USER_LOGIN_POLICY, IP, IDENTIFIER)

        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("Retry-After", ctx.exception.headers)

    def test_depassement_de_la_limite_par_ip_renvoie_429(self):
        for i in range(USER_LOGIN_POLICY.max_attempts_per_ip):
            self.limiter.register_failure("user", USER_LOGIN_POLICY, IP, f"compte{i}@example.ma")

        with self.assertRaises(HTTPException) as ctx:
            self.limiter.ensure_can_attempt("user", USER_LOGIN_POLICY, IP, "autre@example.ma")
        self.assertEqual(ctx.exception.status_code, 429)

    def test_delai_progressif_apres_echecs_consecutifs(self):
        _fail_n_times(self.limiter, "user", USER_LOGIN_POLICY, USER_LOGIN_POLICY.progressive_after)

        with self.assertRaises(HTTPException) as ctx:
            self.limiter.ensure_can_attempt("user", USER_LOGIN_POLICY, IP, IDENTIFIER)
        self.assertEqual(ctx.exception.status_code, 429)

    def test_message_429_generique_sans_fuite_d_existence(self):
        _fail_n_times(self.limiter, "user", USER_LOGIN_POLICY, USER_LOGIN_POLICY.max_attempts_per_identifier)
        with self.assertRaises(HTTPException) as ctx:
            self.limiter.ensure_can_attempt("user", USER_LOGIN_POLICY, IP, IDENTIFIER)
        self.assertEqual(ctx.exception.detail, RATE_LIMIT_DETAIL)
        self.assertNotIn(IDENTIFIER, str(ctx.exception.detail))

    def test_succes_reinitialise_le_compteur_identifiant(self):
        _fail_n_times(self.limiter, "user", USER_LOGIN_POLICY, USER_LOGIN_POLICY.progressive_after)
        self.limiter.register_success("user", IP, IDENTIFIER)
        # Plus de verrou progressif ni de compteur sur l'identifiant.
        self.limiter.ensure_can_attempt("user", USER_LOGIN_POLICY, "10.0.0.9", IDENTIFIER)

    def test_admin_plus_strict_que_user(self):
        self.assertLess(
            ADMIN_LOGIN_POLICY.max_attempts_per_identifier,
            USER_LOGIN_POLICY.max_attempts_per_identifier,
        )
        self.assertLess(
            ADMIN_LOGIN_POLICY.max_attempts_per_ip,
            USER_LOGIN_POLICY.max_attempts_per_ip,
        )

    def test_alerte_apres_echecs_admin(self):
        with self.assertLogs("souki.security", level="WARNING") as captured:
            _fail_n_times(
                self.limiter,
                "admin",
                ADMIN_LOGIN_POLICY,
                ADMIN_LOGIN_POLICY.alert_after_failures,
                identifier="admin@example.ma",
            )
        self.assertTrue(any("SECURITE" in line for line in captured.output))
        # L'alerte ne journalise pas l'identifiant du compte vise.
        self.assertFalse(any("admin@example.ma" in line for line in captured.output))


class UserActionQuotaTests(unittest.TestCase):
    """VULN-008 : quota utilisateur pour les appels IA."""

    def test_quota_depasse_renvoie_429(self):
        quota = UserActionQuota(backend=_MemoryBackend())
        quota.ensure_within_quota("ai-basket", 1, max_calls=2, window_seconds=3600)
        quota.ensure_within_quota("ai-basket", 1, max_calls=2, window_seconds=3600)

        with self.assertRaises(HTTPException) as ctx:
            quota.ensure_within_quota("ai-basket", 1, max_calls=2, window_seconds=3600)
        self.assertEqual(ctx.exception.status_code, 429)

    def test_quota_est_par_utilisateur(self):
        quota = UserActionQuota(backend=_MemoryBackend())
        quota.ensure_within_quota("ai-basket", 1, max_calls=1, window_seconds=3600)
        # Un autre utilisateur n'est pas affecte.
        quota.ensure_within_quota("ai-basket", 2, max_calls=1, window_seconds=3600)


if __name__ == "__main__":
    unittest.main()
