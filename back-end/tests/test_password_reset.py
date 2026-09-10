import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from jose import jwt

from services.password_reset_service import (
    GENERIC_PASSWORD_RESET_MESSAGE,
    PASSWORD_RESET_PURPOSE,
    PasswordResetService,
)
from security import verify_password


class PasswordResetTokenTests(unittest.TestCase):
    def setUp(self):
        self.user = SimpleNamespace(id=42, password="$2b$12$existing-password-hash")

    def test_token_contient_un_usage_et_une_version_du_mot_de_passe(self):
        token = PasswordResetService._create_token(self.user)
        payload = PasswordResetService._decode_token(token)
        self.assertEqual(payload["sub"], "42")
        self.assertEqual(payload["purpose"], PASSWORD_RESET_PURPOSE)
        self.assertEqual(
            payload["pwdv"],
            PasswordResetService._password_version(self.user.password),
        )

    def test_token_dun_autre_usage_est_refuse(self):
        from config import ALGORITHM, SECRET_KEY

        token = jwt.encode(
            {"sub": "42", "purpose": "access", "pwdv": "x"},
            SECRET_KEY,
            algorithm=ALGORITHM,
        )
        with self.assertRaises(HTTPException) as context:
            PasswordResetService._decode_token(token)
        self.assertEqual(context.exception.status_code, 400)

    def test_token_malforme_est_refuse(self):
        with self.assertRaises(HTTPException) as context:
            PasswordResetService._decode_token("not-a-token")
        self.assertEqual(context.exception.status_code, 400)


class PasswordResetRequestTests(unittest.TestCase):
    @patch("services.password_reset_service.EmailDeliveryService.send_password_reset_email")
    @patch("services.password_reset_service.LocalSession")
    def test_compte_inconnu_recoit_la_meme_reponse_sans_email(self, session_factory, send_email):
        query = session_factory.return_value.query.return_value
        query.filter.return_value.first.return_value = None

        response = PasswordResetService().request_reset("unknown@example.com")

        self.assertEqual(response, {"message": GENERIC_PASSWORD_RESET_MESSAGE})
        send_email.assert_not_called()
        session_factory.return_value.close.assert_called_once()

    @patch("services.password_reset_service.EmailDeliveryService.send_password_reset_email")
    @patch("services.password_reset_service.LocalSession")
    def test_compte_connu_recoit_un_lien_mais_la_reponse_reste_generique(self, session_factory, send_email):
        user = SimpleNamespace(
            id=42,
            email="client@example.com",
            password="$2b$12$existing-password-hash",
        )
        query = session_factory.return_value.query.return_value
        query.filter.return_value.first.return_value = user

        response = PasswordResetService().request_reset("CLIENT@example.com")

        self.assertEqual(response, {"message": GENERIC_PASSWORD_RESET_MESSAGE})
        send_email.assert_called_once()
        self.assertEqual(send_email.call_args.args[0], "client@example.com")
        self.assertGreater(len(send_email.call_args.args[1]), 20)


class PasswordResetExecutionTests(unittest.TestCase):
    @patch("services.password_reset_service.LocalSession")
    def test_reset_modifie_le_mot_de_passe_et_revoque_les_sessions(self, session_factory):
        from security import hash_password

        old_password = "Ancien123"
        user = SimpleNamespace(
            id=42,
            password=hash_password(old_password),
            auth_provider="google",
        )
        token = PasswordResetService._create_token(user)
        user_query = session_factory.return_value.query.return_value
        user_query.filter.return_value.with_for_update.return_value.first.return_value = user
        session_query = unittest.mock.Mock()
        session_factory.return_value.query.side_effect = [user_query, session_query]

        response = PasswordResetService().reset_password(token, "Nouveau123")

        self.assertTrue(verify_password("Nouveau123", user.password))
        self.assertEqual(user.auth_provider, "google,local")
        session_query.filter.return_value.update.assert_called_once()
        update_values = session_query.filter.return_value.update.call_args.args[0]
        self.assertEqual(list(update_values.values()), [False])
        self.assertEqual(
            session_query.filter.return_value.update.call_args.kwargs,
            {"synchronize_session": False},
        )
        session_factory.return_value.commit.assert_called_once()
        self.assertIn("réinitialisé", response["message"])

    @patch("services.password_reset_service.LocalSession")
    def test_lien_deja_utilise_est_refuse(self, session_factory):
        user = SimpleNamespace(id=42, password="$2b$12$new-password-hash", auth_provider="local")
        user_query = session_factory.return_value.query.return_value
        user_query.filter.return_value.with_for_update.return_value.first.return_value = user

        with patch.object(
            PasswordResetService,
            "_decode_token",
            return_value={"sub": "42", "pwdv": "ancienne-version"},
        ), self.assertRaises(HTTPException) as context:
            PasswordResetService().reset_password("token", "Nouveau123")

        self.assertEqual(context.exception.status_code, 400)
        session_factory.return_value.rollback.assert_called_once()


if __name__ == "__main__":
    unittest.main()
