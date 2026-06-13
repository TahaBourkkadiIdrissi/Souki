"""Tests unitaires de la logique de calcul de prix (produit_pricing_service).

Le calcul du prix affiche suit la regle :
    1. prix_vente_manuel renseigne -> prioritaire (override admin)
    2. sinon prix_gros present      -> gros * (1+coussin) * (1+marge), tous niveaux
    3. sinon                        -> None (produit masque du catalogue + alerte)
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from services.produit_pricing_service import ProduitPricingServiceBD


@pytest.fixture
def service():
    # _calculer_prix_affiche n'utilise pas le DAO : on peut l'injecter a None.
    return ProduitPricingServiceBD(dao=None)


class TestCalculPrix:
    def test_calcul_standard(self, service):
        # 10 * 1.10 * 1.25 = 13.75 -> 13.8
        assert service._calculer_prix_affiche(
            prix_gros=10.0, marge_cible=0.25, coussin_securite=0.10
        ) == 13.8

    def test_n1_respecte_marge_et_coussin(self, service):
        # Plus de cas special N1 : meme formule. 5 * 1.05 * 1.05 = 5.5125 -> 5.6
        assert service._calculer_prix_affiche(
            prix_gros=5.0, marge_cible=0.05, coussin_securite=0.05
        ) == 5.6

    def test_override_prioritaire(self, service):
        # prix_vente_manuel ignore gros / marge / coussin
        assert service._calculer_prix_affiche(
            prix_gros=5.0, marge_cible=0.25, coussin_securite=0.10, prix_vente_manuel=7.0
        ) == 7.0

    def test_override_arrondi(self, service):
        assert service._calculer_prix_affiche(
            prix_gros=None, marge_cible=0.0, coussin_securite=0.0, prix_vente_manuel=7.23
        ) == 7.3

    def test_sans_gros_ni_override_retourne_none(self, service):
        assert service._calculer_prix_affiche(
            prix_gros=None, marge_cible=0.25, coussin_securite=0.10
        ) is None

    def test_gros_zero_respecte(self, service):
        # 0 volontaire -> 0 (pas de fallback prix_kg)
        assert service._calculer_prix_affiche(
            prix_gros=0.0, marge_cible=0.25, coussin_securite=0.10
        ) == 0.0

    def test_pas_de_bug_flottant(self, service):
        # 18 * 1.05 = 18.9 et non 19.0 (le round neutralise le bruit flottant)
        assert service._calculer_prix_affiche(
            prix_gros=18.0, marge_cible=0.05, coussin_securite=0.0
        ) == 18.9

    def test_arrondi_dixieme_superieur(self, service):
        # 10.01 -> 10.1 (toujours arrondi au dixieme superieur)
        assert service._calculer_prix_affiche(
            prix_gros=10.01, marge_cible=0.0, coussin_securite=0.0
        ) == 10.1
