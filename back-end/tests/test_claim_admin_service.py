"""Ecran admin des reclamations : chiffres, photo presente, stockage illisible."""

import unittest
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from sqlalchemy.exc import SQLAlchemyError

from services.claim_admin_service import ClaimAdminService


def claim(claim_id, commande_id, *, suspect=False):
    return SimpleNamespace(
        id=claim_id, commande_id=commande_id, user_id=7, created_at=datetime(2026, 11, 9, 10, tzinfo=timezone.utc),
        user=SimpleNamespace(prenom="Amina", nom="Benali"),
        commande=SimpleNamespace(date_livraison=date(2026, 11, 9)),
        ligne_panier=SimpleNamespace(produit=SimpleNamespace(nom_fr="Tomates", unite="kg")),
        reason="abime", quantity_claimed=1, amount_refunded=7, status="REFUNDED", is_suspect=suspect,
    )


class ClaimAdminServiceTests(unittest.TestCase):
    def setUp(self):
        self.dao = MagicMock()
        self.session = MagicMock()
        self.service = ClaimAdminService(self.dao, self.session)
        self.dao.stats_since.return_value = (3, 21.0, 1)
        self.dao.list_recent.return_value = [claim(55, 2041), claim(56, 2041, suspect=True)]

    def test_overview_marks_claims_with_a_photo(self):
        self.dao.existing_photo_names.return_value = {"2041/55.jpg"}
        self.dao.count_photos_since.return_value = 1

        result = self.service.get_overview(100)

        self.assertEqual((result.total_30j, result.montant_30j, result.suspects_30j, result.avec_photo_30j), (3, 21.0, 1, 1))
        self.assertEqual([item.has_photo for item in result.items], [True, False])
        self.assertEqual(result.items[0].client_nom, "Amina Benali")
        self.assertEqual(result.items[0].produit, "Tomates")
        self.session.commit.assert_not_called()

    def test_unreadable_storage_still_lists_claims(self):
        self.dao.existing_photo_names.side_effect = SQLAlchemyError("permission denied for schema storage")

        result = self.service.get_overview(100)

        self.assertEqual(len(result.items), 2)
        self.assertEqual([item.has_photo for item in result.items], [None, None])
        self.assertIsNone(result.avec_photo_30j)
        self.session.rollback.assert_called_once()

    def test_limit_is_capped(self):
        self.dao.existing_photo_names.return_value = set()
        self.dao.count_photos_since.return_value = 0

        self.service.get_overview(10_000)

        self.dao.list_recent.assert_called_once_with(self.session, 200)


if __name__ == "__main__":
    unittest.main()
