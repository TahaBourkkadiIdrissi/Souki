import os
import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from auth_dependencies import require_client, require_livreur
from services.jit_service import JITService
from services.logistics_visibility import is_livreur_tournee_row_visible
from services.admin_exception_service import AdminExceptionService
from services.checkout_service import CheckoutService
from tests.test_security_checkout_stock import _FakeCheckoutDao, _FakeSession, _product, _payload
from tests.test_dispatch_supplier_pickup import _service, _commande, _livreur


@patch.dict(os.environ, {"SOUKI_ENABLE_SUPPLIERS": "0", "SOUKI_PREORDERS": "1"})
class SoukiOperatingModeTests(unittest.TestCase):
    def test_supplier_routes_are_not_registered(self):
        import main
        paths = {route.path for route in main.create_app().routes}
        self.assertFalse(any(path.startswith("/api/supplier") for path in paths))
        self.assertFalse(any(path.startswith("/api/admin/suppliers") for path in paths))

    def test_jit_locks_without_supplier_resolution(self):
        order = SimpleNamespace(id=1, client_id=2, statut="CONFIRMEE", fournisseur_id=None)
        service = JITService(MagicMock())
        service._get_commandes_du_jour = MagicMock(return_value=[order])
        service._get_default_geolocated_addresses = MagicMock(return_value={})
        with patch("services.jit_service.resoudre_fournisseur_pour_adresse") as resolve, patch("services.jit_service.changer_statut") as change:
            self.assertEqual(service.verrouiller_commandes(MagicMock()), 1)
            resolve.assert_not_called()
            self.assertIsNone(order.fournisseur_id)
            self.assertEqual(change.call_args.kwargs["nouveau_statut"], "VERROUILLEE")

    @patch("services.dispatch_service.notification_service.notify")
    @patch("services.dispatch_service.process_end_of_day_returns", return_value=0)
    @patch("services.dispatch_service.changer_statut")
    def test_dispatch_uses_souki_and_only_notifies_riders(self, change, returns, notify):
        session = MagicMock()
        session.in_transaction.return_value = False
        service = _service(session)
        orders = [_commande(1, None, 34.01, -5.0), _commande(2, None, 34.02, -5.0)]
        service.commande_dao.get_commandes_non_assignees.return_value = orders
        service.livreur_dao.get_available_livreurs.return_value = [_livreur(101)]
        service.tournee_dao.create_tournee.return_value = SimpleNamespace(id=10)
        result = service.generate_daily_routes(date(2026, 6, 20))
        self.assertEqual(result["commandes_assigned"], 2)
        self.assertIsNone(service.tournee_dao.create_tournee.call_args.kwargs["fournisseur_id"])
        session.get.assert_not_called()
        self.assertEqual([c.kwargs["event_key"] for c in notify.call_args_list], ["TOURNEE_ASSIGNED"])

    def test_souki_tour_visible_without_supplier(self):
        today = date(2026, 6, 20)
        self.assertTrue(is_livreur_tournee_row_visible({"date_tournee": today, "statut": "A_LIVRER", "fournisseur_id": None}, today))
        reasons = AdminExceptionService.detect_raisons(SimpleNamespace(statut="VERROUILLEE", fournisseur_id=None), today=today)
        self.assertNotIn("SANS_FOURNISSEUR", reasons)

    @patch("services.checkout_service.ORDER_CUTOFF_ENABLED", False)
    @patch("services.checkout_service.notification_service.notify")
    def test_preorder_accepts_zero_stock_without_decrement(self, notify):
        product = _product(stock=0)
        dao = _FakeCheckoutDao([product])
        service = CheckoutService(dao, session=_FakeSession(dao))
        self.assertEqual(service.create_checkout(1, _payload(2)).status, "success")
        self.assertEqual(product.stock, 0)
        product.is_active = False
        with self.assertRaises(ValueError):
            service.create_checkout(1, _payload(2))

    def test_operational_accounts_cannot_use_client_wallet_or_checkout(self):
        for role in ("LIVREUR", "FOURNISSEUR", "ADMIN", "PARENT"):
            with self.subTest(role=role), self.assertRaises(HTTPException):
                require_client(SimpleNamespace(roles={"CLIENT", role}))
        principal = SimpleNamespace(roles={"CLIENT"})
        self.assertIs(require_client(principal), principal)

    def test_only_rider_accounts_can_execute_delivery_actions(self):
        for role in ("CLIENT", "FOURNISSEUR", "ADMIN", "PARENT"):
            with self.subTest(role=role), self.assertRaises(HTTPException):
                require_livreur(SimpleNamespace(roles={role}))
        principal = SimpleNamespace(roles={"LIVREUR"})
        self.assertIs(require_livreur(principal), principal)


class ProductionOriginTests(unittest.TestCase):
    @patch.dict(os.environ, {"SOUKI_ENV": "production", "FRONTEND_ORIGINS": "https://souki.example,https://admin.souki.example"})
    def test_cookie_writes_require_origin_matching_proxy_host(self):
        from fastapi.testclient import TestClient
        from tests.test_security_cors_csrf_errors import _build_app
        from config import ACCESS_TOKEN_COOKIE_NAME
        client = TestClient(_build_app())
        client.cookies.set(ACCESS_TOKEN_COOKIE_NAME, "test-cookie")
        for headers in ({}, {"Origin": "https://souki.example"}, {"Origin": "https://souki.example", "X-Souki-Origin": "https://admin.souki.example"}):
            self.assertEqual(client.post("/echo", headers=headers).status_code, 403)
        self.assertEqual(client.post("/echo", headers={"Origin": "https://admin.souki.example", "X-Souki-Origin": "https://admin.souki.example"}).status_code, 200)


class ProductionConfigurationTests(unittest.TestCase):
    def _valid_environment(self):
        return {
            "SOUKI_ENV": "production",
            "DATABASE_URL": "postgresql+psycopg2://user:password@db.example/postgres",
            "SECRET_KEY": "a" * 32,
            "COOKIE_SECURE": "1",
            "FRONTEND_ORIGINS": "https://souki.example,https://livreur.souki.example,https://admin.souki.example",
            "SOUKI_DEPOT_ADDRESS": "Adresse test",
            "SOUKI_DEPOT_CITY": "Fès",
            "SOUKI_DEPOT_PHONE": "+212600000000",
            "SOUKI_DEPOT_LAT": "34.0331",
            "SOUKI_DEPOT_LNG": "-5.0003",
            "NEXT_PUBLIC_GOOGLE_CLIENT_ID": "souki-test.apps.googleusercontent.com",
            "GOOGLE_CLIENT_ID": "souki-test.apps.googleusercontent.com",
            "SOUKI_PUBLIC_URL": "https://souki.io",
            "RESEND_API_KEY": "re_test_only",
            "RESEND_FROM_EMAIL": "SOUKI <no-reply@souki.io>",
        }

    def test_valid_production_configuration_is_accepted(self):
        from production_checks import validate_production_config
        with patch.dict(os.environ, self._valid_environment(), clear=True):
            validate_production_config()

    def test_missing_database_or_depot_configuration_fails_closed(self):
        from production_checks import validate_production_config
        environment = self._valid_environment()
        environment["DATABASE_URL"] = ""
        environment["SOUKI_DEPOT_LAT"] = ""
        with patch.dict(os.environ, environment, clear=True), self.assertRaises(RuntimeError) as context:
            validate_production_config()
        self.assertIn("DATABASE_URL", str(context.exception))
        self.assertIn("SOUKI_DEPOT_LAT", str(context.exception))

    def test_wildcard_or_http_origin_is_rejected(self):
        from production_checks import validate_production_config
        for origin in ("http://souki.example", "https://*.souki.example"):
            environment = self._valid_environment()
            environment["FRONTEND_ORIGINS"] = origin
            with self.subTest(origin=origin), patch.dict(os.environ, environment, clear=True), self.assertRaises(RuntimeError):
                validate_production_config()

    def test_google_client_ids_are_required_and_must_match(self):
        from production_checks import validate_production_config

        missing_environment = self._valid_environment()
        missing_environment["GOOGLE_CLIENT_ID"] = ""
        with patch.dict(os.environ, missing_environment, clear=True), self.assertRaises(RuntimeError) as context:
            validate_production_config()
        self.assertIn("GOOGLE_CLIENT_ID", str(context.exception))

        mismatched_environment = self._valid_environment()
        mismatched_environment["GOOGLE_CLIENT_ID"] = "other-client.apps.googleusercontent.com"
        with patch.dict(os.environ, mismatched_environment, clear=True), self.assertRaises(RuntimeError) as context:
            validate_production_config()
        self.assertIn("doivent être identiques", str(context.exception))
