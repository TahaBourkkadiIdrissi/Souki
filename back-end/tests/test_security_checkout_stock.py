"""SALAH-03 / VULN-006 : stock atomique au checkout.

- les produits sont charges avec SELECT ... FOR UPDATE dans un ordre stable ;
- deux checkouts sur le meme stock ne peuvent pas survendre : le second echoue
  et le stock ne devient jamais negatif ;
- l'echec declenche un rollback (le stock decremente en memoire est annule).
"""

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from pydantic import ValidationError

from dao.checkout_dao import CheckoutDaoBD
from dto.checkout_dto import CheckoutItemDTO, CheckoutRequestDTO
from services import checkout_service as checkout_module
from services.checkout_service import CheckoutService, is_order_cutoff_active


class _FakeCheckoutDao:
    """DAO factice qui partage un stock produit entre les checkouts."""

    def __init__(self, products):
        self.products = {int(p.id): p for p in products}
        self.for_update_calls = []
        self.snapshots = []

    def get_or_create_client(self, session, user_id):
        return SimpleNamespace(user_id=user_id, is_blacklisted=False, abonnement_actif=False)

    def update_user_phone(self, session, user_id, phone):
        pass

    def upsert_user_delivery_address(self, session, user_id, street, city, details):
        pass

    def get_products_by_ids(self, session, product_ids, for_update=False):
        self.for_update_calls.append((tuple(product_ids), for_update))
        return [self.products[int(pid)] for pid in product_ids if int(pid) in self.products]

    def create_panier(self, session, user_id, total_legumes, total_facture, marge_brute):
        return SimpleNamespace(id=101)

    def create_ligne_panier(self, session, panier_id, produit_id, quantite_kg, sous_total):
        pass

    def create_commande(self, session, **kwargs):
        return SimpleNamespace(id=202)


def _product(product_id=1, stock=5.0, prix=10.0):
    return SimpleNamespace(
        id=product_id,
        nom_fr="Tomate",
        is_active=True,
        unite="kg",
        stock=stock,
        prix_kg=prix,
        prix_affiche=None,
    )


def _payload(quantity, product_id=1):
    return CheckoutRequestDTO(
        items=[CheckoutItemDTO(product_id=product_id, quantity=quantity)],
        creneau_livraison="08:00",
        mode_paiement="cod",
        contact_phone="+212612345678",
        delivery_address="Rue Ibn Khaldoun",
        delivery_city="Fes",
    )


class _FakeSession:
    """Session factice avec rollback restaurant le stock (comme une vraie transaction)."""

    def __init__(self, dao):
        self._dao = dao

    def _snapshot(self):
        return {pid: float(p.stock) for pid, p in self._dao.products.items()}

    def commit(self):
        pass

    def rollback(self):
        if self._dao.snapshots:
            for pid, stock in self._dao.snapshots[-1].items():
                self._dao.products[pid].stock = stock

    def close(self):
        pass


def _run_checkout(service, dao, payload, user_id=1):
    dao.snapshots.append({pid: float(p.stock) for pid, p in dao.products.items()})
    return service.create_checkout(user_id, payload)


class CheckoutStockAtomiqueTests(unittest.TestCase):
    def setUp(self):
        self.dao = _FakeCheckoutDao([_product(stock=5.0)])
        self.service = CheckoutService(self.dao, session=_FakeSession(self.dao))
        # Neutralise le cutoff horaire pour tester uniquement le stock.
        patcher = patch.object(checkout_module, "ORDER_CUTOFF_ENABLED", False)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_les_produits_sont_verrouilles_for_update_dans_un_ordre_stable(self):
        self.dao.products[2] = _product(product_id=2, stock=5.0)
        payload = CheckoutRequestDTO(
            items=[
                CheckoutItemDTO(product_id=2, quantity=1),
                CheckoutItemDTO(product_id=1, quantity=1),
            ],
            mode_paiement="cod",
            contact_phone="+212612345678",
            delivery_address="Rue Ibn Khaldoun",
            delivery_city="Fes",
        )
        _run_checkout(self.service, self.dao, payload)

        self.assertEqual(len(self.dao.for_update_calls), 1)
        requested_ids, for_update = self.dao.for_update_calls[0]
        self.assertTrue(for_update, "le chargement produits doit exiger FOR UPDATE")
        self.assertEqual(list(requested_ids), sorted(requested_ids), "ordre de verrouillage stable")

    def test_deux_checkouts_concurrents_ne_survendent_pas(self):
        first = _run_checkout(self.service, self.dao, _payload(quantity=4))
        self.assertEqual(first.status, "success")
        self.assertEqual(self.dao.products[1].stock, 1.0)

        with self.assertRaises(ValueError):
            _run_checkout(self.service, self.dao, _payload(quantity=4))

        self.assertGreaterEqual(self.dao.products[1].stock, 0.0, "le stock ne doit jamais etre negatif")
        self.assertEqual(self.dao.products[1].stock, 1.0, "le rollback doit restaurer le stock")

    def test_requete_sql_generee_contient_for_update(self):
        query_mock = MagicMock()
        session = MagicMock()
        session.query.return_value.filter.return_value.order_by.return_value = query_mock

        CheckoutDaoBD().get_products_by_ids(session, [1, 2], for_update=True)
        query_mock.with_for_update.assert_called_once()

        query_mock.reset_mock()
        CheckoutDaoBD().get_products_by_ids(session, [1, 2], for_update=False)
        query_mock.with_for_update.assert_not_called()


class OrderCutoffTests(unittest.TestCase):
    """BUG-001 : le cutoff backend est restaure et actif par defaut."""

    def test_cutoff_actif_par_defaut(self):
        # Sans variable d'environnement, le garde-fou reste actif.
        with patch.dict("os.environ", {}, clear=False):
            import importlib

            module = importlib.reload(checkout_module)
            try:
                self.assertTrue(module.ORDER_CUTOFF_ENABLED)
            finally:
                importlib.reload(checkout_module)

    def test_fenetre_horaire_du_cutoff(self):
        from datetime import datetime
        from zoneinfo import ZoneInfo

        casablanca = ZoneInfo("Africa/Casablanca")
        self.assertTrue(is_order_cutoff_active(datetime(2026, 7, 8, 21, 0, tzinfo=casablanca)))
        self.assertTrue(is_order_cutoff_active(datetime(2026, 7, 8, 7, 30, tzinfo=casablanca)))
        self.assertFalse(is_order_cutoff_active(datetime(2026, 7, 8, 12, 0, tzinfo=casablanca)))

    def test_checkout_refuse_pendant_le_cutoff(self):
        dao = _FakeCheckoutDao([_product()])
        service = CheckoutService(dao, session=_FakeSession(dao))
        with patch.object(checkout_module, "ORDER_CUTOFF_ENABLED", True), patch.object(
            checkout_module, "is_order_cutoff_active", return_value=True
        ):
            with self.assertRaises(HTTPException) as ctx:
                service.create_checkout(1, _payload(quantity=1))
        self.assertEqual(ctx.exception.status_code, 403)


class DeliveryTimeValidationTests(unittest.TestCase):
    def test_bornes_du_creneau_sont_acceptees(self):
        for delivery_time in ("08:00", "10:30", "15:00"):
            with self.subTest(delivery_time=delivery_time):
                payload = CheckoutRequestDTO(
                    items=[CheckoutItemDTO(product_id=1, quantity=1)],
                    creneau_livraison=delivery_time,
                )
                self.assertEqual(payload.creneau_livraison, delivery_time)

    def test_heures_hors_creneau_sont_refusees(self):
        for delivery_time in ("07:59", "15:01", "23:00"):
            with self.subTest(delivery_time=delivery_time), self.assertRaises(ValidationError):
                CheckoutRequestDTO(
                    items=[CheckoutItemDTO(product_id=1, quantity=1)],
                    creneau_livraison=delivery_time,
                )

    def test_format_libre_est_refuse(self):
        with self.assertRaises(ValidationError):
            CheckoutRequestDTO(
                items=[CheckoutItemDTO(product_id=1, quantity=1)],
                creneau_livraison="8h-10h",
            )


if __name__ == "__main__":
    unittest.main()
