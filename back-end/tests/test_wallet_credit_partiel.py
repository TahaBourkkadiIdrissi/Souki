"""Credit Wallet deduit du montant a payer : le Wallet paie ce qu'il peut, le reste est encaisse a la porte."""
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from dto.checkout_dto import CheckoutItemDTO, CheckoutRequestDTO
from services import checkout_service as checkout_module
from services.checkout_service import CheckoutService
from services.livreur_service import LivreurService
from services import livreur_service as livreur_module
from services.order_payment import cash_due, split_debit, split_return, wallet_share


class _Dao:
    def __init__(self, balance=None, blacklisted=False, offert=0):
        self.wallet = (SimpleNamespace(id="w1", balance=Decimal(str(balance)), solde_offert=Decimal(str(offert)))
                       if balance is not None else None)
        self.blacklisted = blacklisted
        self.debits = []
        self.commande = None
        self.product = SimpleNamespace(id=1, nom_fr="Tomate", is_active=True, unite="kg", stock=100.0, prix_kg=10.0, prix_affiche=None)

    def lock_order_batch(self, session, key): pass
    def get_or_create_client(self, session, user_id): return SimpleNamespace(user_id=user_id, is_blacklisted=self.blacklisted, abonnement_actif=False)
    def update_user_phone(self, session, user_id, phone): pass
    def upsert_user_delivery_address(self, session, user_id, street, city, details): pass
    def get_products_by_ids(self, session, ids, for_update=False): return [self.product]
    def create_panier(self, session, **kwargs): return SimpleNamespace(id=1)
    def create_ligne_panier(self, session, **kwargs): pass
    def get_wallet_for_update(self, session, user_id): return self.wallet

    def debit_wallet(self, session, wallet, amount):
        offert, _ = split_debit(wallet.solde_offert, amount)
        wallet.balance -= amount
        wallet.solde_offert -= offert
        self.debits.append(amount)
        return offert

    def create_commande(self, session, **kwargs):
        self.commande = SimpleNamespace(id=9, **kwargs)
        return self.commande


class _Session:
    def commit(self): pass
    def rollback(self): pass
    def close(self): pass
    def get_bind(self): return SimpleNamespace(dialect=SimpleNamespace(name="sqlite"))


def _checkout(dao, quantity=10, mode="cod", utiliser_wallet=True):
    payload = CheckoutRequestDTO(
        items=[CheckoutItemDTO(product_id=1, quantity=quantity)], mode_paiement=mode, utiliser_wallet=utiliser_wallet,
        contact_phone="+212612345678", delivery_address="Rue 1", delivery_city="Fes",
    )
    with patch.object(checkout_module, "ORDER_CUTOFF_ENABLED", False), \
         patch.object(checkout_module.notification_service, "notify"):
        return CheckoutService(dao, session=_Session()).create_checkout(1, payload)


def test_credit_partiel_deduit_le_reste_paye_a_la_porte():
    dao = _Dao(balance=15)
    result = _checkout(dao)  # 100 DH de produits + 15 DH de livraison
    assert result.montant_total == 115.0
    assert (result.montant_wallet, result.reste_a_payer, result.mode_paiement) == (15.0, 100.0, "cod")
    assert dao.debits == [Decimal("15")] and dao.wallet.balance == 0
    assert dao.commande.montant_wallet == 15.0


def test_credit_qui_couvre_tout_passe_la_commande_en_wallet():
    dao = _Dao(balance=200)
    result = _checkout(dao)
    assert (result.montant_wallet, result.reste_a_payer, result.mode_paiement) == (115.0, 0.0, "wallet")
    assert dao.wallet.balance == Decimal("85")


def test_sans_option_le_wallet_nest_pas_touche():
    dao = _Dao(balance=15)
    result = _checkout(dao, utiliser_wallet=False)
    assert result.montant_wallet == 0.0 and dao.debits == []


def test_wallet_vide_ou_absent_reste_en_cod():
    for dao in (_Dao(balance=0), _Dao(balance=None)):
        result = _checkout(dao)
        assert (result.montant_wallet, result.reste_a_payer) == (0.0, 115.0)


def test_paiement_wallet_complet_garde_son_controle_de_solde():
    with pytest.raises(HTTPException) as exc:
        _checkout(_Dao(balance=20), mode="wallet", utiliser_wallet=False)
    assert exc.value.status_code == 400


def test_compte_bloque_en_cod_ne_passe_que_si_le_wallet_couvre_tout():
    with pytest.raises(HTTPException) as exc:
        _checkout(_Dao(balance=15, blacklisted=True))
    assert exc.value.status_code == 403
    assert _checkout(_Dao(balance=500, blacklisted=True)).mode_paiement == "wallet"


def test_montant_a_encaisser_par_le_livreur():
    assert cash_due(115, 15, "cod") == 100.0
    assert cash_due(115, 115, "wallet") == 0.0
    # Commandes "wallet" anterieures a la colonne montant_wallet : tout a ete paye par le Wallet.
    assert wallet_share(115, 0, "wallet") == Decimal("115.00")
    assert cash_due(115, 0, "cod") == 115.0


def test_le_credit_offert_part_en_premier():
    # 20 DH dont 15 DH offerts : la commande prend les 15 DH offerts puis 5 DH rembourses.
    dao = _Dao(balance=20, offert=15)
    result = _checkout(dao)
    assert result.montant_wallet == 20.0
    assert dao.commande.montant_wallet_offert == Decimal("15")
    assert dao.wallet.solde_offert == 0


def test_repartition_des_retours_rend_d_abord_l_argent_rembourse():
    assert split_debit(15, 40) == (Decimal("15.00"), Decimal("25.00"))
    assert split_debit(50, 40) == (Decimal("40.00"), Decimal("0.00"))
    # Part Wallet 40 DH dont 15 offerts : rendre 30 DH -> 25 rembourses puis 5 offerts.
    assert split_return(30, 40, 15) == (Decimal("5.00"), Decimal("25.00"))


def _refus(commande):
    service = LivreurService.__new__(LivreurService)
    wallet = SimpleNamespace(balance=Decimal("0"), solde_offert=Decimal("0"))
    credits = []
    fake = SimpleNamespace(
        get_or_create_wallet=lambda user_id, session=None: wallet,
        credit_wallet=lambda session, **kwargs: credits.append(kwargs),
    )
    with patch.object(livreur_module, "_wallet_refund_service", fake):
        service._refund_real_wallet_share_on_refusal(session=None, commande=commande, target_status="REFUS")
    return credits


def test_refus_a_la_porte_rend_seulement_l_argent_rembourse():
    commande = SimpleNamespace(client_id=7, montant_total=115, montant_wallet=40, montant_wallet_offert=15, mode_paiement="cod")
    credits = _refus(commande)
    assert len(credits) == 1 and credits[0]["amount"] == Decimal("25.00")
    assert credits[0]["transaction_type"] == "CREDIT_REFUS"
    assert commande.montant_wallet == 15.0  # la part offerte reste consommee


def test_refus_avec_seulement_du_credit_offert_ne_rend_rien():
    commande = SimpleNamespace(client_id=7, montant_total=115, montant_wallet=15, montant_wallet_offert=15, mode_paiement="cod")
    assert _refus(commande) == []
