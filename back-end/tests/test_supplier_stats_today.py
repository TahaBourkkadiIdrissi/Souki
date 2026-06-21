from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from services.fournisseur_service import FournisseurService


TODAY = date(2026, 6, 20)
SUPPLIER_ID = 10


def _scalar_query(value):
    query = MagicMock()
    query.filter.return_value.scalar.return_value = value
    return query


def _orders_query(commandes):
    query = MagicMock()
    query.filter.return_value.order_by.return_value.all.return_value = commandes
    return query


def test_supplier_stats_only_count_current_visible_orders():
    visible = SimpleNamespace(
        id=1,
        fournisseur_id=SUPPLIER_ID,
        date_commande=datetime(2026, 6, 20, 9, 0),
        statut="VERROUILLEE",
        montant_total=125.0,
    )
    wrong_supplier = SimpleNamespace(
        id=2,
        fournisseur_id=99,
        date_commande=datetime(2026, 6, 20, 10, 0),
        statut="VERROUILLEE",
        montant_total=300.0,
    )
    old_order = SimpleNamespace(
        id=3,
        fournisseur_id=SUPPLIER_ID,
        date_commande=datetime(2026, 6, 19, 10, 0),
        statut="A_LIVRER",
        montant_total=200.0,
    )
    inactive_status = SimpleNamespace(
        id=4,
        fournisseur_id=SUPPLIER_ID,
        date_commande=datetime(2026, 6, 20, 11, 0),
        statut="LIVREE",
        montant_total=500.0,
    )

    session = MagicMock()
    session.query.side_effect = [
        _scalar_query(7),
        _scalar_query(5),
        _orders_query([visible, wrong_supplier, old_order, inactive_status]),
    ]
    service = FournisseurService(MagicMock(), MagicMock(), session=session)
    service._ensure_supplier_role = MagicMock()

    with patch("services.fournisseur_service.today_morocco", return_value=TODAY):
        result = service.get_supplier_stats(SUPPLIER_ID)

    assert result.products_count == 7
    assert result.active_products_count == 5
    assert result.orders_count == 1
    assert result.revenue_total == 125.0
