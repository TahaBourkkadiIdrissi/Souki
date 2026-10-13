"""Inscription reservee a Fes : zone de service et controle cote serveur."""

import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException

from dto.user_dto import UserRegister
from services.auth_service import AuthService
from services.service_area import is_in_service_area, out_of_area_message


def _payload(**overrides):
    data = {
        "email": "client@example.com",
        "password": "Motdepasse1",
        "latitude": 34.0331,
        "longitude": -5.0003,
        "adresse": "Avenue Hassan II, Fès",
        "ville": "Fès",
    }
    data.update(overrides)
    return UserRegister(**data)


class ServiceAreaTests(unittest.TestCase):
    def test_quartiers_de_fes_sont_couverts(self):
        for name, lat, lng in (
            ("centre", 34.0331, -5.0003),
            ("medina", 34.0617, -4.9836),
            ("ain chkef", 33.9833, -5.0167),
            ("bensouda", 34.0167, -5.0667),
            ("aeroport fes-saiss", 33.9273, -4.9781),
        ):
            with self.subTest(name):
                self.assertTrue(is_in_service_area(lat, lng))

    def test_villes_hors_fes_sont_exclues(self):
        for name, lat, lng in (
            ("moulay yacoub", 34.0875, -5.1806),
            ("sefrou", 33.8305, -4.8353),
            ("meknes", 33.8935, -5.5473),
            ("casablanca", 33.5731, -7.5898),
        ):
            with self.subTest(name):
                self.assertFalse(is_in_service_area(lat, lng))

    def test_message_cite_la_ville_detectee(self):
        message = out_of_area_message("Meknès")
        self.assertIn("pas encore disponible à Meknès", message)
        self.assertIn("Fès", message)

    def test_message_sans_ville_detectee(self):
        self.assertIn("dans votre ville", out_of_area_message(None))
        self.assertIn("dans votre ville", out_of_area_message("  "))


class RegisterServiceAreaTests(unittest.TestCase):
    @patch("services.auth_service.LocalSession")
    def test_position_hors_fes_refusee_avant_toute_creation(self, local_session):
        data = _payload(latitude=33.8935, longitude=-5.5473, ville="Meknès")
        with self.assertRaises(HTTPException) as context:
            AuthService().register(data)
        self.assertEqual(context.exception.status_code, 422)
        self.assertIn("Meknès", context.exception.detail)
        local_session.assert_not_called()

    @patch("services.auth_service.LocalSession")
    def test_position_absente_refusee(self, local_session):
        data = _payload(latitude=None, longitude=None)
        with self.assertRaises(HTTPException) as context:
            AuthService().register(data)
        self.assertEqual(context.exception.status_code, 422)
        local_session.assert_not_called()

    def test_position_a_fes_acceptee(self):
        AuthService._ensure_in_service_area(_payload())

    def test_adresse_par_defaut_creee_depuis_la_position(self):
        db = Mock()
        AuthService._save_signup_address(db, SimpleNamespace(id=42), _payload())
        address = db.add.call_args.args[0]
        self.assertEqual(address.user_id, 42)
        self.assertEqual(address.street, "Avenue Hassan II, Fès")
        self.assertEqual(address.ville, "Fès")
        self.assertEqual((address.latitude, address.longitude), (34.0331, -5.0003))
        self.assertTrue(address.is_default)

    def test_adresse_sans_geocodage_retombe_sur_les_coordonnees(self):
        db = Mock()
        AuthService._save_signup_address(db, SimpleNamespace(id=7), _payload(adresse=None, ville=None))
        address = db.add.call_args.args[0]
        self.assertEqual(address.street, "34.033100, -5.000300")
        self.assertEqual(address.ville, "Fès")


if __name__ == "__main__":
    unittest.main()
