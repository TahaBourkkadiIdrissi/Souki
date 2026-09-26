"""The settings API preserves edited names when the profile is reloaded."""

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from pydantic import ValidationError

from dto.settings_dto import PersonalInfoUpdateDTO
from services.settings_service import SettingsService


class ProfileNameTests(unittest.TestCase):
    def setUp(self):
        self.service = SettingsService()
        self.user = SimpleNamespace(
            id=42,
            prenom=None,
            nom=None,
            email="ancien.nom@example.ma",
            phone="+212612345678",
            avatar_url=None,
            is_email_verified=True,
            is_phone_verified=True,
            is_verified=True,
        )
        self.db = MagicMock()
        self.db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

    def test_editing_name_is_saved_and_returned_on_reload(self):
        # update: user lookup, email uniqueness, phone uniqueness; read: user
        self.db.query.return_value.filter.return_value.first.side_effect = [
            self.user, None, None, self.user
        ]
        data = PersonalInfoUpdateDTO(
            prenom="  Amina  ", nom="  El Idrissi  ",
            email=self.user.email, telephone=self.user.phone,
        )

        with patch("services.settings_service.LocalSession", return_value=self.db):
            result = self.service.update_personal_info(self.user.id, data)
            profile = self.service.get_profile(self.user.id)

        self.assertEqual(result, {"success": True, "email_changed": False})
        self.db.commit.assert_called_once()
        self.assertEqual((self.user.prenom, self.user.nom), ("Amina", "El Idrissi"))
        self.assertEqual((profile["prenom"], profile["nom"]), ("Amina", "El Idrissi"))
        self.db.close.assert_called()

    def test_existing_account_without_saved_name_keeps_email_fallback(self):
        self.db.query.return_value.filter.return_value.first.return_value = self.user

        with patch("services.settings_service.LocalSession", return_value=self.db):
            profile = self.service.get_profile(self.user.id)

        self.assertEqual((profile["prenom"], profile["nom"]), ("Ancien", "Nom"))

    def test_name_longer_than_column_is_rejected(self):
        with self.assertRaises(ValidationError):
            PersonalInfoUpdateDTO(
                prenom="A" * 101, nom="Nom",
                email=self.user.email, telephone=self.user.phone,
            )


if __name__ == "__main__":
    unittest.main()
