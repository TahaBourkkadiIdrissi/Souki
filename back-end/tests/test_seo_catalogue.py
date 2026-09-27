import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from services.catalogue_service import CatalogueService


class CatalogueSEOTests(unittest.TestCase):
    def setUp(self):
        self.product = SimpleNamespace(id=38, nom_fr="Tomates", nom_darija="tomates",
            prix_kg=10, prix_affiche=12, prix_gros_saisi=None, prix_khddar_reel=None,
            is_active=True, image_url=None, niveau=2, unite="kg", stock=0)
        self.service = CatalogueService(None)

    def test_historical_product_has_no_invented_date(self):
        self.assertIsNone(self.service._to_product_response(self.product).updated_at)

    def test_known_date_reaches_serialized_api(self):
        self.product.updated_at = datetime(2026, 9, 27, 12, tzinfo=timezone.utc)
        result = self.service._to_product_response(self.product)
        self.assertEqual(result.updated_at, self.product.updated_at)
        self.assertIn("2026-09-27T12:00:00", result.model_dump_json())

    def test_stock_and_operating_mode_define_real_offer_availability(self):
        with patch('services.catalogue_service.preorders_enabled', return_value=False):
            self.assertEqual(self.service._to_product_response(self.product).availability, "out_of_stock")
            self.product.stock = 1
            self.assertEqual(self.service._to_product_response(self.product).availability, "in_stock")
        self.product.stock = 0
        with patch('services.catalogue_service.preorders_enabled', return_value=True):
            self.assertEqual(self.service._to_product_response(self.product).availability, "preorder")
            self.product.is_active = False
            self.assertEqual(self.service._to_product_response(self.product).availability, "out_of_stock")


if __name__ == '__main__':
    unittest.main()
