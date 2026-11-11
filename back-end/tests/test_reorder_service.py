"""« Recommander » (B9) : prix du jour, disponibilite du catalogue, commande d'un autre client."""

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from services.reorder_service import REASON_REMOVED, REASON_UNAVAILABLE, ReorderService


def product(pid, *, active=True, stock=10.0, prix_affiche=8.0, prix_kg=7.0, nom="Tomate", unite="kg"):
    return SimpleNamespace(id=pid, is_active=active, stock=stock, prix_affiche=prix_affiche, prix_kg=prix_kg,
                           nom_fr=nom, nom_ar=None, unite=unite, image_url=None)


def line(prod, quantity, old_subtotal=99.0):
    return SimpleNamespace(produit=prod, quantite_kg=quantity, sous_total=old_subtotal)


class ReorderServiceTests(unittest.TestCase):
    def setUp(self):
        self.dao = MagicMock()
        self.session = MagicMock()
        self.service = ReorderService(self.dao, self.session)

    def order(self, *lines):
        return SimpleNamespace(id=2041, panier=SimpleNamespace(lignes=list(lines)))

    @patch("services.reorder_service.preorders_enabled", return_value=False)
    def test_prices_of_today_not_of_the_old_order(self, _):
        self.dao.get_owned_order_with_products.return_value = self.order(line(product(1, prix_affiche=8.5), 2))

        result = self.service.get_reorder(7, 2041)

        self.dao.get_owned_order_with_products.assert_called_once_with(self.session, 2041, 7)
        self.assertEqual(result.lignes[0].prix_unitaire, 8.5)
        self.assertEqual(result.lignes[0].sous_total, 17.0)
        self.assertEqual(result.total_dh, 17.0)
        self.assertTrue(result.lignes[0].disponible)

    @patch("services.reorder_service.preorders_enabled", return_value=False)
    def test_falls_back_to_prix_kg(self, _):
        self.dao.get_owned_order_with_products.return_value = self.order(line(product(1, prix_affiche=None, prix_kg=6.0), 1.5))

        result = self.service.get_reorder(7, 2041)

        self.assertEqual(result.lignes[0].prix_unitaire, 6.0)
        self.assertEqual(result.total_dh, 9.0)

    @patch("services.reorder_service.preorders_enabled", return_value=False)
    def test_out_of_stock_and_removed_products_are_excluded_from_total(self, _):
        self.dao.get_owned_order_with_products.return_value = self.order(
            line(product(1, prix_affiche=10.0), 1),
            line(product(2, stock=0), 1),
            line(product(3, active=False), 1),
        )

        result = self.service.get_reorder(7, 2041)

        by_id = {entry.product_id: entry for entry in result.lignes}
        self.assertEqual(result.total_dh, 10.0)
        self.assertEqual(result.nombre_disponibles, 1)
        self.assertEqual((by_id[2].disponible, by_id[2].prix_unitaire, by_id[2].raison), (False, None, REASON_UNAVAILABLE))
        self.assertEqual((by_id[3].disponible, by_id[3].raison), (False, REASON_REMOVED))

    @patch("services.reorder_service.preorders_enabled", return_value=True)
    def test_preorders_keep_products_without_stock_available(self, _):
        self.dao.get_owned_order_with_products.return_value = self.order(line(product(2, stock=0, prix_affiche=5.0), 2))

        result = self.service.get_reorder(7, 2041)

        self.assertTrue(result.lignes[0].disponible)
        self.assertEqual(result.total_dh, 10.0)

    def test_order_of_another_client_is_not_found(self):
        self.dao.get_owned_order_with_products.return_value = None

        with self.assertRaises(HTTPException) as raised:
            self.service.get_reorder(7, 2041)

        self.assertEqual(raised.exception.status_code, 404)

    def test_read_only_never_commits(self):
        self.dao.get_owned_order_with_products.return_value = self.order()

        self.service.get_reorder(7, 2041)

        self.session.commit.assert_not_called()
        self.session.flush.assert_not_called()


if __name__ == "__main__":
    unittest.main()
