"""Tests de la couche plats marocains (dataset, matching, mise a l'echelle)."""

import json
from pathlib import Path

import pytest

from services.dish_composition_service import (
    DEFAULT_DATASET_PATH,
    DishCompositionService,
)


@pytest.fixture(scope="module")
def service() -> DishCompositionService:
    return DishCompositionService()


@pytest.fixture(scope="module")
def dataset() -> list[dict]:
    return json.loads(Path(DEFAULT_DATASET_PATH).read_text(encoding="utf-8"))


# ── Contrat du dataset ────────────────────────────────────────────────────────

def test_dataset_contient_au_moins_100_plats(dataset):
    # 100 plats d'origine + la categorie "jus" ajoutee ensuite.
    assert len(dataset) >= 100


def test_dataset_ids_et_noms_uniques(dataset):
    ids = [d["dish_id"] for d in dataset]
    noms = [d["name_fr"].lower() for d in dataset]
    assert len(ids) == len(set(ids))
    assert len(noms) == len(set(noms))


def test_dataset_schema_et_quantites(dataset):
    for entry in dataset:
        assert entry["dish_id"] and entry["name_fr"] and entry["name_darija"]
        assert entry["category"]
        assert 1 <= int(entry["default_servings"]) <= 8
        assert entry["ingredients"], entry["dish_id"]
        for ingredient in entry["ingredients"]:
            assert ingredient["product_reference"]
            assert float(ingredient["quantity"]) > 0
            assert ingredient["unit"]
            if ingredient["missing_from_catalog"]:
                assert ingredient["catalog_product_id"] is None
            else:
                assert isinstance(ingredient["catalog_product_id"], int)


def test_ingredients_hors_catalogue_sont_flagges_pas_inventes(dataset):
    # Aucun ingredient "manquant" ne doit porter un id catalogue.
    for entry in dataset:
        for ingredient in entry["ingredients"]:
            if ingredient["catalog_product_id"] is not None:
                assert not ingredient["missing_from_catalog"]


# ── Correspondance nom de plat -> plat ───────────────────────────────────────

@pytest.mark.parametrize(
    ("texte", "dish_id"),
    [
        ("je veux faire un tajine de poulet", "tajine-poulet-citron-olives"),
        ("wach mumkin harira", "harira"),
        ("couscous pour 6 personnes", "couscous-sept-legumes"),
        ("zaalouk", "zaalouk"),
        ("je veux preparer une rfissa ce soir", "rfissa"),
        ("BISSARA", "bissara"),
    ],
)
def test_match_dish_reconnait_les_plats(service, texte, dish_id):
    match = service.match_dish(texte)
    assert match is not None and match["dish_id"] == dish_id


@pytest.mark.parametrize(
    "texte",
    [
        "je veux une pizza",
        "je veux 2 kilos de tomates",
        "bonjour",
        "",
    ],
)
def test_match_dish_ignore_les_textes_sans_plat(service, texte):
    assert service.match_dish(texte) is None


def test_parse_personnes(service):
    assert service.parse_personnes("couscous pour 6 personnes") == 6
    assert service.parse_personnes("harira pour 1 personne") == 1
    assert service.parse_personnes("tajine de poulet") is None
    assert service.parse_personnes("pour 25 personnes") is None  # hors bornes


# ── Mise a l'echelle ─────────────────────────────────────────────────────────

def test_scale_quantity_kg_proportionnel(service):
    assert service.scale_quantity(1.0, "kg", 0.5) == 0.5
    assert service.scale_quantity(0.8, "kg", 2.0) == 1.6
    assert service.scale_quantity(0.1, "kg", 0.25) == 0.1  # plancher


def test_scale_quantity_unites_indivisibles(service):
    assert service.scale_quantity(1, "lot", 0.5) == 1.0    # pas de demi-lot
    assert service.scale_quantity(2, "lot", 1.5) == 3.0
    assert service.scale_quantity(1, "250g", 0.5) == 1.0


# ── Pre-check voix/texte ─────────────────────────────────────────────────────

def test_items_for_text_structure(service):
    result = service.items_for_text("couscous pour 6 personnes")
    assert result is not None
    assert result["personnes"] == 6
    assert result["items"], "les ingredients catalogue doivent produire des items"
    for item in result["items"]:
        assert item["produit_fr"]
        assert item["quantite"] > 0
    # Les ingredients hors catalogue sont signales, jamais convertis en items.
    assert "semoule de ble" in result["ingredients_manquants"]
    references_items = {item["produit_fr"] for item in result["items"]}
    assert not references_items & set(result["ingredients_manquants"])


def test_items_for_text_sans_plat(service):
    assert service.items_for_text("je veux des carottes et des tomates") is None
