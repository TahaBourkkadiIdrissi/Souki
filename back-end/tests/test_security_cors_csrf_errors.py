"""HAMZA-03 (RISK-004), TAHA-06 (VULN-010, CSRF) et SALAH-05 (RISK-002).

- CORS : origines strictes, regex locale desactivee en production, methodes et
  en-tetes restreints ; une origine non declaree n'obtient aucun acces CORS.
- CSRF : une ecriture authentifiee par cookie avec une origine etrangere est
  refusee (403).
- Erreurs : aucune reponse 500 ne contient le texte brut d'une exception.
"""

import os
import unittest
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import main as main_module
from config import ACCESS_TOKEN_COOKIE_NAME
from services.business_errors import GENERIC_ERROR_MESSAGE, internal_error_http

ALLOWED_ORIGIN = "http://localhost:3000"
EVIL_ORIGIN = "https://evil.example"


def _build_app():
    app = FastAPI()
    main_module.configure_cors(app)
    main_module.register_csrf_protection(app)

    @app.post("/echo")
    def echo():
        return {"ok": True}

    return app


class CorsConfigTests(unittest.TestCase):
    def test_production_exige_frontend_origins(self):
        env = {k: v for k, v in os.environ.items() if k != "FRONTEND_ORIGINS"}
        env["SOUKI_ENV"] = "production"
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaises(RuntimeError):
                main_module.get_allowed_origins()

    def test_production_desactive_la_regex_locale(self):
        with patch.dict(
            os.environ,
            {"SOUKI_ENV": "production", "FRONTEND_ORIGINS": "https://souki.ma"},
        ):
            self.assertIsNone(main_module.get_allowed_origin_regex())
            self.assertEqual(main_module.get_allowed_origins(), ["https://souki.ma"])

    def test_developpement_conserve_le_repli_localhost(self):
        env = {k: v for k, v in os.environ.items() if k not in {"FRONTEND_ORIGINS", "SOUKI_ENV"}}
        with patch.dict(os.environ, env, clear=True):
            self.assertIn(ALLOWED_ORIGIN, main_module.get_allowed_origins())
            self.assertIsNotNone(main_module.get_allowed_origin_regex())

    def test_les_methodes_et_en_tetes_sont_restreints(self):
        self.assertNotIn("*", main_module.CORS_ALLOWED_METHODS)
        self.assertNotIn("*", main_module.CORS_ALLOWED_HEADERS)


class CorsBehaviourTests(unittest.TestCase):
    def setUp(self):
        env = {k: v for k, v in os.environ.items() if k not in {"FRONTEND_ORIGINS", "SOUKI_ENV"}}
        patcher = patch.dict(os.environ, env, clear=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client = TestClient(_build_app())

    def _preflight(self, origin):
        return self.client.options(
            "/echo",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )

    def test_origine_autorisee_recoit_les_en_tetes_cors(self):
        response = self._preflight(ALLOWED_ORIGIN)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN
        )

    def test_origine_refusee_ne_recoit_aucun_acces_cors(self):
        response = self._preflight(EVIL_ORIGIN)
        self.assertNotEqual(response.status_code, 200)
        self.assertIsNone(response.headers.get("access-control-allow-origin"))


class CsrfProtectionTests(unittest.TestCase):
    def setUp(self):
        env = {k: v for k, v in os.environ.items() if k not in {"FRONTEND_ORIGINS", "SOUKI_ENV"}}
        patcher = patch.dict(os.environ, env, clear=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client = TestClient(_build_app())

    def test_ecriture_cookie_avec_origine_etrangere_refusee(self):
        self.client.cookies.set(ACCESS_TOKEN_COOKIE_NAME, "jwt-de-session")
        response = self.client.post("/echo", headers={"Origin": EVIL_ORIGIN})
        self.assertEqual(response.status_code, 403)

    def test_ecriture_cookie_avec_origine_declaree_acceptee(self):
        self.client.cookies.set(ACCESS_TOKEN_COOKIE_NAME, "jwt-de-session")
        response = self.client.post("/echo", headers={"Origin": ALLOWED_ORIGIN})
        self.assertEqual(response.status_code, 200)

    def test_client_bearer_sans_cookie_non_concerne(self):
        # L'app mobile (Authorization: Bearer, pas de cookie) n'est pas affectee.
        response = self.client.post(
            "/echo",
            headers={"Origin": EVIL_ORIGIN, "Authorization": "Bearer token-mobile"},
        )
        self.assertEqual(response.status_code, 200)


class BusinessErrorsTests(unittest.TestCase):
    def test_les_details_internes_ne_fuient_pas(self):
        secret_detail = 'duplicate key value violates unique constraint "t_users_pkey"'
        with self.assertLogs("souki.errors", level="ERROR") as captured:
            http_exc = internal_error_http("test.contexte", RuntimeError(secret_detail))

        self.assertIsInstance(http_exc, HTTPException)
        self.assertEqual(http_exc.status_code, 500)
        self.assertNotIn(secret_detail, str(http_exc.detail))
        self.assertIn(GENERIC_ERROR_MESSAGE, str(http_exc.detail))
        self.assertIn("ref:", str(http_exc.detail))

        # L'identifiant de correlation renvoye au client est retrouvable dans les logs.
        correlation_id = str(http_exc.detail).rsplit("ref: ", 1)[1].rstrip(")")
        logs = "\n".join(captured.output)
        self.assertIn(correlation_id, logs)
        self.assertIn("test.contexte", logs)


if __name__ == "__main__":
    unittest.main()
