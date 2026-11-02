"""Paniers SOUKI : proposes depuis l'admin, estimes au prix du jour, souscrits par le client."""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from dto.commande_recurrente_dto import CommandeRecurrenteDepuisPanierDTO, CommandeRecurrenteLigneInDTO
from dto.panier_souki_dto import PanierSoukiInDTO
from services import commande_recurrente_service as recurrente_module
from services.commande_recurrente_service import CommandeRecurrenteService
from services.panier_souki_service import PanierSoukiService



def _product(product_id=1, prix=20.0, active=True):
    return SimpleNamespace(id=product_id, prix_affiche=prix, prix_kg=prix, is_active=active, stock=100.0,
                           nom_fr=f"Produit {product_id}", nom_darija=f"darija {product_id}", unite="kg", image_url=None)


def _panier(lignes, actif=True, panier_id=4):
    return SimpleNamespace(
        id=panier_id, nom="Panier famille", description=None, image_url=None, actif=actif, ordre=0, created_at=None,
        lignes=[SimpleNamespace(product_id=p.id, quantite=q, produit=p) for p, q in lignes],
    )


def _admin_service(products, panier=None):
    dao, session = MagicMock(), MagicMock()
    dao.get_products.return_value = products
    dao.create.return_value = SimpleNamespace(id=4)
    dao.get.return_value = panier
    dao.list.return_value = [panier] if panier else []
    return PanierSoukiService(dao, session), dao, session


def test_le_panier_est_estime_au_prix_du_jour_avec_la_livraison():
    p1, p2 = _product(1, 20.0), _product(2, 15.0)
    service, _, _ = _admin_service([p1, p2], _panier([(p1, 2), (p2, 2)]))
    [dto] = service.list_admin()
    assert (dto.sous_total_estime, dto.frais_livraison_estimes, dto.total_estime) == (70.0, 15.0, 85.0)


def test_un_panier_sous_le_minimum_est_refuse():
    service, _, session = _admin_service([_product(1, 10.0)])
    payload = PanierSoukiInDTO(nom="Petit", lignes=[CommandeRecurrenteLigneInDTO(product_id=1, quantite=2)])
    with pytest.raises(HTTPException) as exc:
        service.create(payload)
    assert exc.value.status_code == 400
    session.rollback.assert_called_once()


def test_creation_valide_commit_et_regroupe_les_doublons():
    p1 = _product(1, 30.0)
    service, dao, session = _admin_service([p1], _panier([(p1, 2)]))
    payload = PanierSoukiInDTO(nom=" Panier ", lignes=[CommandeRecurrenteLigneInDTO(product_id=1, quantite=1),
                                                         CommandeRecurrenteLigneInDTO(product_id=1, quantite=1)])
    service.create(payload)
    values, lignes = dao.create.call_args.args[1], dao.create.call_args.args[2]
    assert values["nom"] == "Panier" and lignes == [dict(product_id=1, quantite=2.0)]
    session.commit.assert_called_once()


def test_un_panier_sans_produit_disponible_n_est_pas_propose():
    p1 = _product(1, 30.0, active=False)
    service, _, _ = _admin_service([p1], _panier([(p1, 2)]))
    assert service.list_public() == []


def _recurrente_service(panier, abonnements=()):
    dao, session = MagicMock(), MagicMock()
    dao.get_panier_souki.return_value = panier
    dao.list_by_client.return_value = list(abonnements)
    dao.get_client.return_value = SimpleNamespace(is_blacklisted=False)
    dao.get_contact.return_value = {"phone": "0612345678", "street": "Rue 1", "ville": "Fes", "details": None}
    dao.get_products.side_effect = lambda _s, ids: [l.produit for l in panier.lignes if l.product_id in set(ids)]
    dao.create.return_value = SimpleNamespace(id=10)
    dao.get.return_value = None
    service = CommandeRecurrenteService(dao, MagicMock(), session)
    return service, dao


@patch.object(recurrente_module, "orders_closed", return_value=False)
def test_abonnement_a_un_panier_copie_ses_produits_disponibles(_closed):
    p1, p2 = _product(1, 30.0), _product(2, 10.0, active=False)
    service, dao = _recurrente_service(_panier([(p1, 2), (p2, 1)]))
    with patch.object(service, "_to_dto", return_value="ok"), patch.object(service, "_get"):
        service.creer_depuis_panier(7, 4, CommandeRecurrenteDepuisPanierDTO(frequence="HEBDOMADAIRE"))
    values, lignes = dao.create.call_args.args[1], dao.create.call_args.args[2]
    assert values["type"] == "PANIER" and values["panier_souki_id"] == 4 and values["mode_paiement"] == "cod"
    assert [ligne["product_id"] for ligne in lignes] == [1]


@patch.object(recurrente_module, "orders_closed", return_value=False)
def test_double_abonnement_au_meme_panier_refuse(_closed):
    p1 = _product(1, 30.0)
    deja = SimpleNamespace(panier_souki_id=4, statut="ACTIVE")
    service, _ = _recurrente_service(_panier([(p1, 2)]), [deja])
    with pytest.raises(HTTPException) as exc:
        service.creer_depuis_panier(7, 4, CommandeRecurrenteDepuisPanierDTO(frequence="HEBDOMADAIRE"))
    assert exc.value.status_code == 409


@patch.object(recurrente_module, "orders_closed", return_value=False)
def test_panier_retire_introuvable(_closed):
    service, _ = _recurrente_service(_panier([]))
    service.dao.get_panier_souki.return_value = None
    with pytest.raises(HTTPException) as exc:
        service.creer_depuis_panier(7, 4, CommandeRecurrenteDepuisPanierDTO(frequence="HEBDOMADAIRE"))
    assert exc.value.status_code == 404
