"""HAMZA-01 / VULN-007 : WebSocket admin securise par ticket opaque.

- ticket a usage unique et duree de vie 30 s ;
- ticket inconnu/expire refuse ;
- session revoquee apres emission -> connexion refusee ;
- permissions absentes -> 403 ;
- l'endpoint WebSocket n'accepte plus de JWT dans la query string.
"""

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from controllers import admin_controller
from services.ws_ticket_service import WS_TICKET_TTL_SECONDS, WsTicketService


class WsTicketServiceTests(unittest.TestCase):
    def test_ticket_valide_est_a_usage_unique(self):
        service = WsTicketService()
        ticket = service.issue_ticket(user_id=7, session_id=99)

        claims = service.consume_ticket(ticket)
        self.assertIsNotNone(claims)
        self.assertEqual(claims.user_id, 7)
        self.assertEqual(claims.session_id, 99)

        self.assertIsNone(service.consume_ticket(ticket), "un ticket ne sert qu'une fois")

    def test_ticket_inconnu_refuse(self):
        service = WsTicketService()
        self.assertIsNone(service.consume_ticket("ticket-bidon"))
        self.assertIsNone(service.consume_ticket(""))

    def test_ticket_expire_refuse(self):
        service = WsTicketService(ttl_seconds=0)
        ticket = service.issue_ticket(user_id=7, session_id=99)
        self.assertIsNone(service.consume_ticket(ticket))

    def test_duree_de_vie_par_defaut_30_secondes(self):
        self.assertEqual(WS_TICKET_TTL_SECONDS, 30)


class _AuthorizeStreamTestCase(unittest.TestCase):
    def _authorize(self, *, session_active=True, user_active=True, has_permissions=True):
        ticket_service = WsTicketService()
        ticket = ticket_service.issue_ticket(user_id=7, session_id=99)

        principal = SimpleNamespace(
            user_id=7,
            has_all_permissions=lambda perms: has_permissions,
        )

        session_service = MagicMock()
        session_service.is_session_active.return_value = session_active

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = (
            SimpleNamespace(id=7, is_active=user_active) if user_active else None
        )

        authorization_service = MagicMock()
        authorization_service.return_value.build_principal.return_value = principal

        with patch.object(admin_controller, "ws_ticket_service", ticket_service), patch.object(
            admin_controller, "UserSessionService", return_value=session_service
        ), patch.object(admin_controller, "LocalSession", return_value=db), patch.object(
            admin_controller, "AuthorizationService", authorization_service
        ):
            return admin_controller._authorize_delivery_stream(ticket)


class AuthorizeDeliveryStreamTests(_AuthorizeStreamTestCase):
    def test_ticket_valide_et_session_active_autorise(self):
        principal = self._authorize()
        self.assertEqual(principal.user_id, 7)

    def test_session_revoquee_apres_emission_refusee(self):
        with self.assertRaises(HTTPException) as ctx:
            self._authorize(session_active=False)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_compte_desactive_refuse(self):
        with self.assertRaises(HTTPException) as ctx:
            self._authorize(user_active=False)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_permission_absente_refusee(self):
        with self.assertRaises(HTTPException) as ctx:
            self._authorize(has_permissions=False)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_jwt_expire_ou_arbitraire_refuse(self):
        # Un JWT (meme valide) passe en guise de ticket est refuse : seul un
        # ticket emis par POST /admin/ws-ticket est accepte.
        with self.assertRaises(HTTPException) as ctx:
            admin_controller._authorize_delivery_stream("eyJhbGciOiJIUzI1NiJ9.fake.jwt")
        self.assertEqual(ctx.exception.status_code, 401)


class WebSocketRouteContractTests(unittest.TestCase):
    def test_le_endpoint_http_emet_un_ticket_borne(self):
        principal = SimpleNamespace(user_id=7, session_id=99)
        response = admin_controller.create_delivery_stream_ticket(principal=principal)
        self.assertIn("ticket", response)
        self.assertEqual(response["expires_in_seconds"], WS_TICKET_TTL_SECONDS)

        claims = admin_controller.ws_ticket_service.consume_ticket(response["ticket"])
        self.assertIsNotNone(claims)
        self.assertEqual(claims.user_id, 7)


if __name__ == "__main__":
    unittest.main()
