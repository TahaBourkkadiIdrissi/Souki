"""Entree de l'app : compte existant ou nouveau (B12) et renouvellement de session."""

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from jose import jwt

from config import ALGORITHM, SECRET_KEY
from services.auth_mobile_service import REFRESH_GRACE, AuthMobileService
from services.user_session_service import UserSessionService


def token(user_id=7, expires_in=timedelta(hours=1), role="CLIENT"):
    exp = datetime.now(timezone.utc) + expires_in
    return jwt.encode({"sub": str(user_id), "role": role, "exp": int(exp.timestamp())}, SECRET_KEY, algorithm=ALGORITHM)


class CheckEmailTests(unittest.TestCase):
    def setUp(self):
        self.dao = MagicMock()
        self.service = AuthMobileService(self.dao, MagicMock())

    def test_unknown_email_is_new(self):
        self.dao.find_user_by_email.return_value = None
        result = self.service.check_email("nouveau@exemple.ma")
        self.assertEqual((result.exists, result.has_password, result.providers), (False, False, []))

    def test_verified_account_with_password(self):
        self.dao.find_user_by_email.return_value = SimpleNamespace(is_active=True, is_verified=True, password="hash", auth_provider="local")
        result = self.service.check_email("amina@exemple.ma")
        self.assertEqual((result.exists, result.has_password), (True, True))

    def test_google_account_without_password(self):
        self.dao.find_user_by_email.return_value = SimpleNamespace(is_active=True, is_verified=False, password=None, auth_provider="google")
        result = self.service.check_email("amina@gmail.com")
        self.assertEqual((result.exists, result.has_password, result.providers), (True, False, ["google"]))

    def test_unverified_or_deleted_account_is_treated_as_new(self):
        self.dao.find_user_by_email.return_value = SimpleNamespace(is_active=True, is_verified=False, password="hash", auth_provider="local")
        self.assertFalse(self.service.check_email("pending@exemple.ma").exists)
        self.dao.find_user_by_email.return_value = SimpleNamespace(is_active=False, is_verified=False, password=None, auth_provider="local")
        self.assertFalse(self.service.check_email("supprime-7@supprime.invalid").exists)


class RefreshSessionTests(unittest.TestCase):
    def setUp(self):
        self.dao = MagicMock()
        self.session = MagicMock()
        self.service = AuthMobileService(self.dao, self.session)
        self.record = SimpleNamespace(user_id=7)
        self.user = SimpleNamespace(id=7, email="amina@exemple.ma", is_active=True)
        self.dao.find_active_session.return_value = self.record
        self.dao.find_user.return_value = self.user
        principal = SimpleNamespace(roles={"CLIENT"}, primary_role="CLIENT", legacy_role="CLIENT", default_dashboard="/", has_role=lambda role: role == "CLIENT")
        patcher = patch("services.auth_mobile_service.AuthorizationService")
        self.addCleanup(patcher.stop)
        patcher.start().return_value.build_principal.return_value = principal

    def test_expired_token_of_an_active_session_is_renewed_and_rotated(self):
        old = token(expires_in=-timedelta(days=3))

        result = self.service.refresh_session(old)

        payload = jwt.decode(result.access_token, SECRET_KEY, algorithms=[ALGORITHM])
        self.assertEqual(payload["sub"], "7")
        self.dao.find_active_session.assert_called_once_with(self.session, UserSessionService._hash_token(old))
        self.dao.rotate_session_token.assert_called_once_with(self.session, self.record, UserSessionService._hash_token(result.access_token))
        self.session.commit.assert_called_once()

    def test_too_old_token_is_refused(self):
        with self.assertRaises(HTTPException) as raised:
            self.service.refresh_session(token(expires_in=-(REFRESH_GRACE + timedelta(hours=1))))
        self.assertEqual(raised.exception.status_code, 401)
        self.dao.rotate_session_token.assert_not_called()

    def test_closed_session_is_refused(self):
        self.dao.find_active_session.return_value = None
        with self.assertRaises(HTTPException) as raised:
            self.service.refresh_session(token())
        self.assertEqual(raised.exception.status_code, 401)
        self.session.commit.assert_not_called()

    def test_forged_token_is_refused(self):
        forged = jwt.encode({"sub": "7", "exp": 9999999999}, "pas-la-bonne-cle", algorithm=ALGORITHM)
        with self.assertRaises(HTTPException) as raised:
            self.service.refresh_session(forged)
        self.assertEqual(raised.exception.status_code, 401)
        self.dao.find_active_session.assert_not_called()

    def test_disabled_account_is_refused(self):
        self.user.is_active = False
        with self.assertRaises(HTTPException):
            self.service.refresh_session(token())
        self.session.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
