"""Tests unitaires du pipeline de generation de panier via Groq.

Aucun appel reseau (client Groq mocke), aucune base de donnees, aucun dataset:
on valide la construction du prompt, la validation semantique et l'orchestration
avec retry.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from dto.panier_dto import PanierRequestDTO
from services.ml_panier_service import BasketGenerationError, MLPanierService


def _product(
    product_id: int,
    nom_fr: str,
    nom_darija: str,
    niveau: int,
    prix: float = 10.0,
    stock: float = 50.0,
    unite: str = "kg",
):
    return SimpleNamespace(
        id=product_id,
        nom_fr=nom_fr,
        nom_darija=nom_darija,
        niveau=niveau,
        prix_kg=prix,
        prix_affiche=None,
        stock=stock,
        unite=unite,
        image_url=None,
    )


@pytest.fixture
def products():
    return [
        _product(1, "Tomates", "Maticha", 1, prix=8.0),
        _product(2, "Carottes", "Khizzou", 2, prix=6.0),
        _product(3, "Fraises", "Toot", 3, prix=25.0),
    ]


@pytest.fixture
def service():
    return MLPanierService()


@pytest.fixture
def payload():
    return PanierRequestDTO(budget=100.0, personnes=4, duree=7, plat=None)


@pytest.fixture
def dish():
    return {
        "dish_id": "jus-orange",
        "name_fr": "Jus d'orange frais",
        "name_darija": "asir portoqal",
        "category": "jus",
        "default_servings": 4,
        "ingredients": [
            {"product_reference": "Oranges", "quantity": 1.2, "unit": "kg",
             "catalog_product_id": 12, "missing_from_catalog": False},
            {"product_reference": "Citrons", "quantity": 0.1, "unit": "kg",
             "catalog_product_id": 13, "missing_from_catalog": False},
            {"product_reference": "sucre", "quantity": 60, "unit": "g",
             "catalog_product_id": None, "missing_from_catalog": True},
        ],
    }


# ── build_system_prompt ───────────────────────────────────────────────────────

def test_prompt_contient_mot_json_pour_le_mode_json(service, products):
    prompt = service.build_system_prompt(products)
    assert "json" in prompt.lower()


def test_prompt_liste_les_produits_du_catalogue(service, products):
    prompt = service.build_system_prompt(products)
    for product in products:
        assert product.nom_fr in prompt
        assert product.nom_darija in prompt
        assert str(product.id) in prompt


def test_prompt_exclut_les_produits_hors_stock(service):
    catalogue = [
        _product(1, "Tomates", "Maticha", 1, stock=0.0),
        _product(2, "Carottes", "Khizzou", 2, stock=10.0),
    ]
    prompt = service.build_system_prompt(catalogue)
    assert "Carottes" in prompt
    assert "Tomates" not in prompt


# ── validate_composition ──────────────────────────────────────────────────────

def test_validation_accepte_composition_valide(service, products):
    data = {
        "composition": [
            {"produit_id": 1, "nom_fr": "Tomates", "quantite": 2},
            {"produit_id": 2, "nom_fr": "Carottes", "quantite": 1.5},
        ]
    }
    assert service.validate_composition(data, products) is True


def test_validation_rejette_structure_invalide(service, products):
    assert service.validate_composition({}, products) is False
    assert service.validate_composition({"composition": []}, products) is False
    assert service.validate_composition({"composition": "x"}, products) is False


def test_validation_rejette_produit_inconnu(service, products):
    data = {"composition": [{"produit_id": 999, "quantite": 1}]}
    assert service.validate_composition(data, products) is False


def test_validation_rejette_quantite_non_positive(service, products):
    data = {
        "composition": [
            {"produit_id": 1, "quantite": 0},
            {"produit_id": 2, "quantite": -3},
        ]
    }
    assert service.validate_composition(data, products) is False


def test_validation_rejette_un_seul_niveau_quand_plusieurs_disponibles(service, products):
    data = {"composition": [{"produit_id": 1, "quantite": 1}]}
    assert service.validate_composition(data, products) is False


def test_validation_resout_par_nom_darija(service, products):
    data = {
        "composition": [
            {"nom_fr": "Maticha", "quantite": 2},
            {"produit_id": 2, "quantite": 1},
        ]
    }
    assert service.validate_composition(data, products) is True


def test_validation_mode_plat_accepte_un_seul_niveau(service, products):
    # Un jus (ex: uniquement des niveaux 2) doit passer en mode plat.
    data = {"composition": [{"produit_id": 2, "quantite": 1}]}
    assert service.validate_composition(data, products, require_levels=False) is True
    # Mais serait rejete en mode equilibre.
    assert service.validate_composition(data, products, require_levels=True) is False


# ── _build_user_input (modes equilibre / plat) ────────────────────────────────

def test_user_input_mode_equilibre(service, payload):
    raw = service._build_user_input(payload, None)
    assert '"mode": "panier_equilibre"' in raw


def test_user_input_mode_plat_contient_les_ingredients(service, payload, dish):
    raw = service._build_user_input(payload, dish)
    assert '"mode": "plat_marocain"' in raw
    # Les ingredients catalogue du plat sont injectes (ids 12 et 13)...
    assert "12" in raw and "13" in raw
    assert "Oranges" in raw
    # ...mais pas les ingredients hors catalogue (sucre).
    assert "sucre" not in raw


# ── call_groq (client mocke) ──────────────────────────────────────────────────

def _mock_client(content: str) -> MagicMock:
    client = MagicMock()
    message = SimpleNamespace(content=content)
    choice = SimpleNamespace(message=message)
    client.chat.completions.create.return_value = SimpleNamespace(choices=[choice])
    return client


def test_call_groq_parse_le_json(service):
    service._client = _mock_client('{"composition": [{"produit_id": 1, "quantite": 2}]}')
    data = service.call_groq("sys", "user")
    assert data == {"composition": [{"produit_id": 1, "quantite": 2}]}


def test_call_groq_leve_sur_json_invalide(service):
    service._client = _mock_client("pas du json")
    with pytest.raises(BasketGenerationError):
        service.call_groq("sys", "user")


def test_call_groq_leve_sur_erreur_reseau(service):
    client = MagicMock()
    client.chat.completions.create.side_effect = RuntimeError("boom")
    service._client = client
    with pytest.raises(BasketGenerationError):
        service.call_groq("sys", "user")


# ── generate_composition_json (orchestration + retry) ─────────────────────────

def test_generate_retente_puis_reussit(monkeypatch, service, products, payload):
    valide = {
        "composition": [
            {"produit_id": 1, "quantite": 2},
            {"produit_id": 2, "quantite": 1},
        ]
    }
    calls = {"n": 0}

    def fake_call(system_prompt, user_input):
        calls["n"] += 1
        if calls["n"] == 1:
            raise BasketGenerationError("premier echec")
        return valide

    monkeypatch.setattr(service, "call_groq", fake_call)
    monkeypatch.setattr("services.ml_panier_service.time.sleep", lambda _s: None)

    result = service.generate_composition_json(payload, products)
    assert result == valide
    assert calls["n"] == 2


def test_generate_leve_apres_deux_echecs(monkeypatch, service, products, payload):
    def always_fail(system_prompt, user_input):
        raise BasketGenerationError("echec")

    monkeypatch.setattr(service, "call_groq", always_fail)
    monkeypatch.setattr("services.ml_panier_service.time.sleep", lambda _s: None)

    with pytest.raises(BasketGenerationError):
        service.generate_composition_json(payload, products)


def test_generate_leve_si_validation_echoue_deux_fois(monkeypatch, service, products, payload):
    invalide = {"composition": [{"produit_id": 999, "quantite": 1}]}
    monkeypatch.setattr(service, "call_groq", lambda s, u: invalide)
    monkeypatch.setattr("services.ml_panier_service.time.sleep", lambda _s: None)

    with pytest.raises(BasketGenerationError):
        service.generate_composition_json(payload, products)


# ── Construction des lignes / remplissage budget (sans réseau) ────────────────

def _lots_product(product_id: int, niveau: int, prix: float):
    # Produit en "lot" (non fractionnable) pour tester l'arrondi entier.
    return _product(product_id, f"Herbe{product_id}", f"3ochb{product_id}", niveau,
                    prix=prix, stock=50.0, unite="lot")


def test_paliers_kg_et_lots(service, products):
    # kg -> paliers de 0.5 (min 0.5); lot -> entier (min 1).
    catalogue = [*products, _lots_product(9, 3, 2.5)]
    generated = {
        "composition": [
            {"produit_id": 1, "quantite": 1.3},  # -> 1.5
            {"produit_id": 2, "quantite": 0.1},  # -> 0.5 (minimum)
            {"produit_id": 9, "quantite": 0.75},  # lot -> 1
        ]
    }
    payload_local = PanierRequestDTO(budget=200, personnes=4, duree=7, plat="jus-orange")
    # balance_levels=False (mode plat): les quantités ne sont que quantifiées par palier.
    lines = service._build_response_lines(generated, catalogue, payload_local, balance_levels=False)
    by_id = {line.product_id: line for line in lines}
    assert by_id[1].quantite_kg == 1.5
    assert by_id[2].quantite_kg == 0.5
    assert by_id[9].quantite_kg == 1.0


def test_toutes_les_quantites_sont_des_paliers(service, products):
    # Après remplissage budget, chaque quantité doit rester un palier valide.
    payload_local = PanierRequestDTO(budget=400, personnes=4, duree=7, plat=None)
    generated = {"composition": [{"produit_id": 1, "quantite": 1}, {"produit_id": 2, "quantite": 1}]}
    lines = service._build_response_lines(generated, products, payload_local, balance_levels=True)
    for line in lines:
        if line.unite.lower() == "kg":
            assert line.quantite_kg >= 0.5 and abs((line.quantite_kg / 0.5) - round(line.quantite_kg / 0.5)) < 1e-9
        else:
            assert line.quantite_kg >= 1 and line.quantite_kg == int(line.quantite_kg)


def test_fill_budget_remplit_sans_depasser(service, products):
    payload_local = PanierRequestDTO(budget=200, personnes=4, duree=7, plat=None)
    generated = {"composition": [{"produit_id": 1, "quantite": 1}, {"produit_id": 2, "quantite": 1}]}
    lines = service._build_response_lines(generated, products, payload_local, balance_levels=True)
    total = sum(line.sous_total for line in lines)
    assert total <= payload_local.budget  # jamais au-dessus du budget
    assert total >= payload_local.budget * 0.7  # rempli vers le budget


def test_fill_budget_rogne_le_depassement(service, products):
    payload_local = PanierRequestDTO(budget=50, personnes=4, duree=7, plat=None)
    generated = {
        "composition": [
            {"produit_id": 1, "quantite": 10},
            {"produit_id": 2, "quantite": 10},
            {"produit_id": 3, "quantite": 10},
        ]
    }
    lines = service._build_response_lines(generated, products, payload_local, balance_levels=True)
    total = sum(line.sous_total for line in lines)
    assert total <= payload_local.budget  # un panier trop cher est rogné sous le budget
