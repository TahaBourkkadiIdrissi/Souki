"""TAHA-01 / VULN-002 : aucun code OTP ni destination dans les logs."""

import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from services.auth_service import AuthService

OTP_CODE = "123456"
EMAIL_DESTINATION = "victime@example.ma"
PHONE_DESTINATION = "+212612345678"


def _user(email=None, phone=None):
    return SimpleNamespace(id=42, email=email, phone=phone)


class OtpLoggingTests(unittest.TestCase):
    def test_envoi_email_ne_journalise_ni_code_ni_destination(self):
        service = AuthService()
        service.otp_provider = lambda destination, code: None  # faux fournisseur (tests uniquement)

        with self.assertLogs("souki.otp", level="DEBUG") as captured:
            service._send_otp(_user(email=EMAIL_DESTINATION), "email", OTP_CODE)

        logs = "\n".join(captured.output)
        self.assertNotIn(OTP_CODE, logs)
        self.assertNotIn(EMAIL_DESTINATION, logs)
        self.assertIn("user_id=42", logs)
        self.assertIn("email", logs)

    def test_echec_fournisseur_ne_journalise_pas_le_code(self):
        service = AuthService()

        def provider_en_panne(destination, code):
            raise RuntimeError(f"SMTP down pour {destination} code={code}")

        service.otp_provider = provider_en_panne

        with self.assertLogs("souki.otp", level="DEBUG") as captured:
            with self.assertRaises(HTTPException) as ctx:
                service._send_otp(_user(email=EMAIL_DESTINATION), "email", OTP_CODE)

        self.assertEqual(ctx.exception.status_code, 503)
        logs = "\n".join(captured.output)
        self.assertNotIn(OTP_CODE, logs)
        self.assertNotIn(EMAIL_DESTINATION, logs)
        # Le detail public reste generique.
        self.assertNotIn(OTP_CODE, str(ctx.exception.detail))

    def test_canal_non_configure_echoue_en_503_sans_afficher_le_code(self):
        service = AuthService()  # aucun fournisseur SMS configure

        with self.assertLogs("souki.otp", level="DEBUG") as captured:
            with self.assertRaises(HTTPException) as ctx:
                service._send_otp(_user(phone=PHONE_DESTINATION), "phone", OTP_CODE)

        self.assertEqual(ctx.exception.status_code, 503)
        logs = "\n".join(captured.output)
        self.assertNotIn(OTP_CODE, logs)
        self.assertNotIn(PHONE_DESTINATION, logs)


if __name__ == "__main__":
    unittest.main()
