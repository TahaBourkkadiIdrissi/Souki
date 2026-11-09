"""La suppression du compte anonymise les donnees personnelles (App Store 5.1.1(v), loi 09-08)."""

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from services.settings_service import SettingsService


class AccountDeletionTests(unittest.TestCase):
    def setUp(self):
        self.session = MagicMock()
        self.dao = MagicMock()
        self.service = SettingsService(self.dao, self.session)
        self.user = SimpleNamespace(
            id=7,
            email="amina@example.ma",
            phone="+212612345678",
            prenom="Amina",
            nom="El Idrissi",
            password="hash",
            avatar_url="7/photo.jpg",
            is_active=True,
            is_verified=True,
            is_email_verified=True,
            is_phone_verified=True,
        )
        self.client = SimpleNamespace(code_parrainage="K7M2P9")
        self.dao.get_user.return_value = self.user
        self.dao.get_client.return_value = self.client
        self.dao.get_order_in_progress.return_value = None

    def test_deletion_frees_email_and_phone_and_erases_identity(self):
        with patch("services.settings_service.avatar_storage_service") as storage:
            result = self.service.delete_account(self.user.id)

        self.assertEqual(result, {"success": True})
        self.assertIsNone(self.user.email)
        self.assertIsNone(self.user.phone)
        self.assertEqual((self.user.prenom, self.user.nom, self.user.password, self.user.avatar_url), (None, None, None, None))
        self.assertFalse(self.user.is_active)
        self.assertFalse(self.user.is_verified)
        self.assertIsNone(self.client.code_parrainage)
        for method in (
            "anonymize_addresses",
            "stop_recurrences",
            "anonymize_sessions",
            "delete_push_subscriptions",
            "delete_favorites",
            "delete_verification_codes",
        ):
            getattr(self.dao, method).assert_called_once_with(self.session, self.user.id)
        self.session.commit.assert_called_once()
        storage.delete_user_avatars.assert_called_once_with(self.user.id)

    def test_order_in_progress_blocks_deletion(self):
        self.dao.get_order_in_progress.return_value = SimpleNamespace(id=2041)

        with self.assertRaises(HTTPException) as raised:
            self.service.delete_account(self.user.id)

        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("N-2041", raised.exception.detail)
        self.assertEqual(self.user.email, "amina@example.ma")
        self.session.commit.assert_not_called()
        self.session.rollback.assert_called_once()

    def test_photo_storage_failure_does_not_undo_deletion(self):
        with patch("services.settings_service.avatar_storage_service") as storage:
            storage.delete_user_avatars.side_effect = RuntimeError("storage down")
            result = self.service.delete_account(self.user.id)

        self.assertEqual(result, {"success": True})
        self.session.commit.assert_called_once()
        self.assertIsNone(self.user.email)


if __name__ == "__main__":
    unittest.main()
