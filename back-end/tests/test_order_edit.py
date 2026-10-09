from datetime import date, datetime
from decimal import Decimal
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from dao.checkout_dao import CheckoutDaoBD
from dao.order_edit_dao import OrderEditDaoBD
from dto.order_edit_dto import OrderEditRequestDTO, OrderEditSaveDTO
from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.panier_entity import Panier
from entities.ligne_panier_entity import LignePanier
from entities.product_entity import Product
from entities.paiement_entity import Paiement
from entities.souki_wallet_entity import SoukiWallet
from entities.transaction_wallet_entity import TransactionWallet
from services.order_edit_service import OrderEditService
from services.order_schedule import MOROCCO_TIMEZONE


def instant(hour, minute=0, day=9):
    return datetime(2026, 10, day, hour, minute, tzinfo=MOROCCO_TIMEZONE)


def request(quantity=6, **kwargs):
    return OrderEditRequestDTO(items=[{"product_id": 1, "quantity": quantity}], expected_version=1, **kwargs)


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv("SOUKI_PREORDERS", "1")
    engine = create_engine("sqlite://")
    for model in (Client, Product, Panier, LignePanier, Commande, Paiement, SoukiWallet, TransactionWallet):
        model.__table__.create(engine)
    with Session(engine) as session:
        session.add(Client(user_id=7, is_blacklisted=False))
        session.add_all([
            Product(id=1, nom_fr="Tomates", nom_darija="tomates", prix_kg=12, prix_affiche=12, unite="kg", stock=10),
            Product(id=2, nom_fr="Carottes", nom_darija="carottes", prix_kg=8, unite="kg", stock=10),
        ])
        basket = Panier(id=1, user_id=7, total_legumes=5, total_facture=65, marge_brute=0)
        basket.lignes.append(LignePanier(id=1, produit_id=1, quantite_kg=5, sous_total=50))
        order = Commande(id=1, client_id=7, panier=basket, statut="EN_ATTENTE", date_livraison=date(2026, 10, 10),
                         creneau_livraison="10:00", montant_total=65, mode_paiement="cod", status_version=1)
        session.add(order)
        session.add(SoukiWallet(user_id=7, wallet_code="TEST", password_hash="test", balance=100))
        session.commit()
        service = OrderEditService(OrderEditDaoBD(), CheckoutDaoBD(), session)
        with patch("services.order_edit_service.local_now", return_value=instant(23)), \
             patch("services.order_edit_service.notification_service.notify") as notify:
            yield service, session, notify
    engine.dispose()


def save(service, payload=None):
    payload = payload or request()
    quote = service.preview(7, 1, payload)
    return service.save(7, 1, OrderEditSaveDTO(**payload.model_dump(), expected_total=quote.total))


def test_preview_has_no_side_effects_and_preserves_agreed_price(setup):
    service, session, notify = setup
    quote = service.preview(7, 1, request())
    assert quote.total == 75  # Agreed price 10, current catalogue price 12.
    assert quote.difference == 10
    assert session.get(Commande, 1).montant_total == 65
    assert session.get(LignePanier, 1).quantite_kg == 5
    assert session.query(TransactionWallet).count() == 0
    notify.assert_not_called()


def test_save_keeps_order_basket_date_slot_and_line_ids(setup):
    service, session, notify = setup
    result = save(service)
    order = session.get(Commande, 1)
    assert result.version == 2
    assert order.id == 1 and order.panier_id == 1
    assert order.date_livraison == date(2026, 10, 10) and order.creneau_livraison == "10:00"
    assert order.statut == "EN_ATTENTE" and order.montant_total == 75
    assert session.get(LignePanier, 1).quantite_kg == 6
    assert session.query(Commande).count() == 1
    notify.assert_called_once()
    assert notify.call_args.kwargs["event_key"] == "ORDER_UPDATED"


@pytest.mark.parametrize("mode", ["cod", "wallet"])
def test_order_below_50_dh_can_be_previewed_and_reduced(setup, mode):
    service, session, _ = setup
    order = session.get(Commande, 1)
    order.mode_paiement = mode
    order.montant_total = order.panier.total_facture = 33  # 18 DH products + 15 DH delivery.
    order.panier.lignes[0].quantite_kg = 1.8
    order.panier.lignes[0].sous_total = 18
    session.commit()

    quote = service.preview(7, 1, request(1.8))
    assert quote.subtotal == 18 and quote.total == 33
    assert session.get(Commande, 1).status_version == 1

    result = save(service, request(1))
    assert result.subtotal == 10 and result.delivery_fee == 15 and result.total == 25
    assert session.get(Commande, 1).montant_total == 25
    assert session.get(LignePanier, 1).quantite_kg == 1
    assert session.query(SoukiWallet).one().balance == (108 if mode == "wallet" else 100)
    assert session.query(TransactionWallet).count() == (1 if mode == "wallet" else 0)


def test_add_remove_and_free_delivery_threshold(setup):
    service, session, _ = setup
    payload = OrderEditRequestDTO(items=[{"product_id": 2, "quantity": 40}], expected_version=1)
    result = save(service, payload)
    assert result.total == 320 and result.delivery_fee == 0
    assert session.get(LignePanier, 1) is None
    assert [(x.produit_id, x.quantite_kg) for x in session.get(Panier, 1).lignes] == [(2, 40)]


@pytest.mark.parametrize("hour,minute,day,allowed", [(23,59,9,True), (0,59,10,True), (1,0,10,False), (8,0,10,False)])
def test_cutoff_is_attached_to_original_delivery_not_reopening(setup, hour, minute, day, allowed):
    service, _, _ = setup
    with patch("services.order_edit_service.local_now", return_value=instant(hour, minute, day)):
        assert service.get_order(7, 1).editable is allowed
        if allowed:
            save(service)
        else:
            with pytest.raises(HTTPException) as exc:
                save(service)
            assert exc.value.status_code == 409


@pytest.mark.parametrize("status", ["VERROUILLEE", "A_LIVRER", "EN_ROUTE", "LIVRE", "ANNULEE"])
def test_logistics_statuses_cannot_be_edited(setup, status):
    service, session, _ = setup
    session.get(Commande, 1).statut = status
    session.commit()
    with pytest.raises(HTTPException):
        save(service)


def test_other_owner_is_not_found_on_read_preview_and_save(setup):
    service, _, _ = setup
    for action in (lambda: service.get_order(8, 1), lambda: service.preview(8, 1, request()),
                   lambda: service.save(8, 1, OrderEditSaveDTO(**request().model_dump(), expected_total=75))):
        with pytest.raises(HTTPException) as exc:
            action()
        assert exc.value.status_code == 404


def test_second_tab_and_repeated_submission_do_not_charge_twice(setup):
    service, session, _ = setup
    session.get(Commande, 1).mode_paiement = "wallet"
    session.commit()
    payload = OrderEditSaveDTO(**request().model_dump(), expected_total=75)
    service.save(7, 1, payload)
    with pytest.raises(HTTPException) as exc:
        service.save(7, 1, payload)
    assert exc.value.status_code == 409
    assert session.query(SoukiWallet).one().balance == Decimal("90")
    assert session.query(TransactionWallet).count() == 1


def test_wallet_credit_and_delivery_fee_return(setup):
    service, session, _ = setup
    order = session.get(Commande, 1)
    order.mode_paiement = "wallet"
    order.montant_total = order.panier.total_facture = 300
    order.panier.lignes[0].quantite_kg = 30
    order.panier.lignes[0].sous_total = 300
    session.commit()
    result = save(service)
    assert result.total == 75 and result.delivery_fee == 15
    assert session.query(SoukiWallet).one().balance == Decimal("325")
    assert session.query(TransactionWallet).one().montant == 225


def test_insufficient_wallet_preserves_everything(setup):
    service, session, notify = setup
    session.get(Commande, 1).mode_paiement = "wallet"
    session.query(SoukiWallet).one().balance = 1
    session.commit()
    with pytest.raises(HTTPException):
        save(service)
    assert session.get(Commande, 1).montant_total == 65
    assert session.get(LignePanier, 1).quantite_kg == 5
    assert session.query(SoukiWallet).one().balance == 1
    assert session.query(TransactionWallet).count() == 0
    notify.assert_not_called()


def test_price_change_requires_new_confirmation(setup):
    service, session, _ = setup
    with pytest.raises(HTTPException) as exc:
        service.save(7, 1, OrderEditSaveDTO(**request().model_dump(), expected_total=1))
    assert exc.value.status_code == 409
    assert session.get(Commande, 1).status_version == 1


def test_stock_delta_and_failed_stock_rollback(setup, monkeypatch):
    service, session, _ = setup
    monkeypatch.setenv("SOUKI_PREORDERS", "0")
    with pytest.raises(HTTPException):
        save(service, request(16))
    assert session.get(Product, 1).stock == 10
    save(service, request(7))
    assert session.get(Product, 1).stock == 8


def test_recheck_after_waiting_for_product_locks(setup):
    service, session, _ = setup
    with patch("services.order_edit_service.local_now", side_effect=[instant(0,59,10), instant(1,0,10)]):
        with pytest.raises(HTTPException):
            service.save(7, 1, OrderEditSaveDTO(**request().model_dump(), expected_total=75))
    assert session.get(Commande, 1).montant_total == 65


def test_atomic_rollback_after_wallet_debit(setup):
    service, session, _ = setup
    session.get(Commande, 1).mode_paiement = "wallet"
    session.commit()
    with patch.object(service.dao, "save_order", side_effect=RuntimeError("write failed")):
        with pytest.raises(RuntimeError):
            save(service)
    assert session.query(SoukiWallet).one().balance == 100
    assert session.query(TransactionWallet).count() == 0
    assert session.get(Commande, 1).montant_total == 65


@pytest.mark.parametrize("mode,paid", [("cmi", False), ("cod", True)])
def test_external_or_collected_payment_is_not_silently_rewritten(setup, mode, paid):
    service, session, _ = setup
    order = session.get(Commande, 1)
    order.mode_paiement, order.payment_validated = mode, paid
    session.commit()
    assert not service.get_order(7, 1).editable
    with pytest.raises(HTTPException):
        save(service)


def test_order_edit_routes_require_authentication():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from controllers.order_edit_controller import router_order_edit
    app = FastAPI()
    app.include_router(router_order_edit)
    with TestClient(app) as client:
        for method, url, body in [
            ("GET", "/api/commandes/1/modification", None),
            ("POST", "/api/commandes/1/modification/apercu", request().model_dump(mode="json")),
            ("PATCH", "/api/commandes/1/modification", {**request().model_dump(mode="json"), "expected_total": 75}),
        ]:
            assert client.request(method, url, json=body).status_code == 401


@pytest.mark.parametrize("items", [[], [{"product_id":1,"quantity":0}], [{"product_id":1,"quantity":"NaN"}],
    [{"product_id":1,"quantity":5},{"product_id":1,"quantity":6}]])
def test_invalid_quantities_and_duplicates_rejected(items):
    with pytest.raises(ValidationError):
        OrderEditRequestDTO(items=items, expected_version=1)
