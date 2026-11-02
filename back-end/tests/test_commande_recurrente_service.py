from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from dto.checkout_dto import CheckoutLineDTO, CheckoutResponseDTO
from dto.commande_recurrente_dto import CommandeRecurrenteLignesUpdateDTO
from services.commande_recurrente_service import CommandeRecurrenteService, _avancer
from services.order_schedule import MOROCCO_TIMEZONE

TODAY = date(2026, 11, 3)


def _product(product_id=1, prix=60.0, active=True, stock=100.0):
    return SimpleNamespace(id=product_id, prix_affiche=prix, prix_kg=prix, is_active=active, stock=stock,
                           nom_fr=f"Produit {product_id}", unite="kg", image_url=None)


def _row(frequence="QUOTIDIENNE", statut="ACTIVE", mode="cod", prochaine=TODAY, lignes=None):
    lignes = lignes if lignes is not None else [SimpleNamespace(product_id=1, quantite=1.0, prix_reference=55.0, produit=_product())]
    return SimpleNamespace(
        id=10, client_id=7, type="COMMANDE", panier_souki_id=None, commande_origine_id=3, frequence=frequence,
        prochaine_livraison=prochaine, statut=statut, pause_jusqu_au=None, mode_paiement=mode,
        creneau_livraison="08:00", contact_phone="0600000000", delivery_address="Rue 1", delivery_city="Fes",
        delivery_instructions=None, lignes=lignes, created_at=None,
    )


def _service(row, products=None, client=None, livraison=None, jit=False, balance=None):
    dao, checkout, session = MagicMock(), MagicMock(), MagicMock()
    dao.get.return_value = row
    dao.get_owned.return_value = row
    dao.list_echeances.return_value = [row.id]
    dao.get_livraison.return_value = livraison
    dao.jit_deja_execute.return_value = jit
    dao.get_products.return_value = products if products is not None else [_product()]
    dao.get_client.return_value = client or SimpleNamespace(is_blacklisted=False)
    dao.wallet_balance.return_value = balance
    dao.dernieres_livraisons.return_value = {}
    dao.update.side_effect = lambda _session, target, values: [setattr(target, k, v) for k, v in values.items()]
    checkout.create_checkout.return_value = CheckoutResponseDTO(
        status="success", commande_id=99, panier_id=5, total_articles=1, sous_total=60.0, frais_livraison=15.0,
        montant_total=75.0, message="ok", date_livraison=TODAY,
        lignes=[CheckoutLineDTO(product_id=1, nom_produit="Produit 1", prix_unitaire=60.0, quantite=1.0)],
    )
    return CommandeRecurrenteService(dao, checkout, session), dao, checkout, session


@pytest.mark.parametrize("frequence,expected", [
    ("QUOTIDIENNE", date(2026, 11, 3)), ("TOUS_LES_3_JOURS", date(2026, 11, 4)),
    ("HEBDOMADAIRE", date(2026, 11, 8)), ("TOUTES_LES_2_SEMAINES", date(2026, 11, 15)),
])
def test_avancer_respecte_le_rythme(frequence, expected):
    assert _avancer(date(2026, 11, 1), frequence, TODAY) == expected


def test_rien_n_est_cree_si_le_jit_a_deja_tourne():
    service, dao, checkout, _ = _service(_row(), jit=True)
    rapport = service.generer_commandes_du_jour(TODAY)
    assert rapport.ignore is True
    checkout.create_checkout.assert_not_called()


def test_commande_creee_au_prix_du_site_pour_la_date_du_jour():
    row = _row()
    service, dao, checkout, session = _service(row)
    rapport = service.generer_commandes_du_jour(TODAY)
    assert (rapport.creees, rapport.sautees, rapport.echecs) == (1, 0, 0)
    kwargs = checkout.create_checkout.call_args.kwargs
    assert kwargs["system_delivery_date"] == TODAY
    dao.save_livraison.assert_called_once_with(session, 10, TODAY, "CREEE", commande_id=99, montant=75.0, motif=None)
    dao.set_prix_reference.assert_called_once_with(session, row, {1: 60.0})
    assert row.prochaine_livraison == date(2026, 11, 4)
    session.rollback.assert_not_called()


def test_le_job_relance_ne_cree_jamais_deux_commandes():
    service, dao, checkout, _ = _service(_row(), livraison=SimpleNamespace(statut="CREEE"))
    rapport = service.generer_commandes_du_jour(TODAY)
    assert rapport.creees == 0
    checkout.create_checkout.assert_not_called()


def test_un_echec_precedent_est_retente():
    service, _, checkout, _ = _service(_row(), livraison=SimpleNamespace(statut="ECHEC"))
    assert service.generer_commandes_du_jour(TODAY).creees == 1
    checkout.create_checkout.assert_called_once()


def test_livraison_sautee_sous_le_minimum():
    row = _row(lignes=[SimpleNamespace(product_id=1, quantite=0.5, prix_reference=None, produit=_product(prix=60.0))])
    service, dao, checkout, session = _service(row)
    rapport = service.generer_commandes_du_jour(TODAY)
    assert rapport.sautees == 1
    checkout.create_checkout.assert_not_called()
    assert dao.save_livraison.call_args.args[3] == "SAUTEE"


def test_produit_indisponible_retire_de_la_commande():
    lignes = [SimpleNamespace(product_id=1, quantite=1.0, prix_reference=None, produit=None),
              SimpleNamespace(product_id=2, quantite=1.0, prix_reference=None, produit=None)]
    service, dao, checkout, _ = _service(_row(lignes=lignes), products=[_product(1), _product(2, active=False)])
    service.generer_commandes_du_jour(TODAY)
    items = checkout.create_checkout.call_args.args[1].items
    assert [item.product_id for item in items] == [1]
    assert dao.save_livraison.call_args.kwargs["motif"] == "Produit indisponible retiré de la commande."


def test_client_bloque_en_paiement_livraison_est_suspendu():
    row = _row()
    service, dao, checkout, _ = _service(row, client=SimpleNamespace(is_blacklisted=True))
    rapport = service.generer_commandes_du_jour(TODAY)
    assert rapport.sautees == 1
    assert row.statut == "SUSPENDUE"
    checkout.create_checkout.assert_not_called()


def test_wallet_insuffisant_passe_en_paiement_a_la_livraison():
    service, _, checkout, _ = _service(_row(mode="wallet"), balance=10.0)
    service.generer_commandes_du_jour(TODAY)
    assert checkout.create_checkout.call_args.args[1].mode_paiement == "cod"


def test_une_erreur_n_arrete_pas_les_autres_abonnements():
    service, dao, checkout, session = _service(_row())
    dao.list_echeances.return_value = [10, 11]
    checkout.create_checkout.side_effect = [HTTPException(400, "Numero deja utilise"), checkout.create_checkout.return_value]
    rapport = service.generer_commandes_du_jour(TODAY)
    assert rapport.echecs == 1
    session.rollback.assert_called_once()
    assert any(call.args[3] == "ECHEC" and call.kwargs["motif"] == "Numero deja utilise"
               for call in dao.save_livraison.call_args_list)


def test_pause_terminee_reprend_automatiquement():
    row = _row(statut="EN_PAUSE")
    row.pause_jusqu_au = TODAY
    service, _, checkout, _ = _service(row)
    assert service.generer_commandes_du_jour(TODAY).creees == 1
    assert row.statut == "ACTIVE"


def test_modifications_client_fermees_entre_1h_et_8h():
    service, _, _, _ = _service(_row())
    payload = CommandeRecurrenteLignesUpdateDTO(lignes=[{"product_id": 1, "quantite": 1}])
    with patch("services.commande_recurrente_service.local_now",
               return_value=datetime(2026, 11, 3, 3, 0, tzinfo=MOROCCO_TIMEZONE)):
        with pytest.raises(HTTPException) as error:
            service.modifier_lignes(7, 10, payload)
    assert error.value.status_code == 409


def test_alerte_prix_affiche_la_variation():
    row = _row()
    service, _, _, _ = _service(row)
    with patch("services.commande_recurrente_service.local_now",
               return_value=datetime(2026, 11, 2, 15, 0, tzinfo=MOROCCO_TIMEZONE)):
        dto = service._to_dto(row)
    assert dto.variation_prix == 5.0
    assert (dto.sous_total_estime, dto.frais_livraison_estimes, dto.total_estime) == (60.0, 15.0, 75.0)


def test_checkout_systeme_ignore_la_fermeture_et_laisse_le_commit_a_l_appelant():
    from dto.checkout_dto import CheckoutItemDTO, CheckoutRequestDTO
    from services.checkout_service import CheckoutService
    session, dao = MagicMock(), MagicMock()
    dao.get_or_create_client.return_value = SimpleNamespace(is_blacklisted=False, user_id=7)
    dao.get_products_by_ids.return_value = [_product()]
    dao.create_panier.return_value = SimpleNamespace(id=5)
    dao.create_commande.return_value = SimpleNamespace(id=9)
    payload = CheckoutRequestDTO(items=[CheckoutItemDTO(product_id=1, quantity=1)], mode_paiement="cod",
                                 contact_phone="0600000000", delivery_address="Rue 1", delivery_city="Fes")
    with patch("services.checkout_service.ORDER_CUTOFF_ENABLED", True), \
         patch("services.checkout_service.is_order_cutoff_active", return_value=True), \
         patch("services.checkout_service.notification_service"):
        response = CheckoutService(dao, session).create_checkout(7, payload, system_delivery_date=TODAY)
    assert response.date_livraison == TODAY
    assert dao.create_commande.call_args.kwargs["date_livraison"] == TODAY
    session.commit.assert_not_called()
    session.flush.assert_called()
