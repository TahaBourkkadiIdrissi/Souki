from types import SimpleNamespace

from dto.panier_dto import PanierRequestDTO
from services.basket_composer_service import compose, targets


def catalogue():
    return [SimpleNamespace(id=i, nom_fr=name, nom_darija="", prix_affiche=None,
                            prix_kg=price, stock=100, unite=unit)
            for i, (name, price, unit) in enumerate([
                ("Pommes de terre", 7, "kg"), ("Tomates", 8, "kg"), ("Oignons", 17, "kg"),
                ("Carottes", 10, "kg"), ("Courgettes", 15, "kg"), ("Poivrons", 14, "kg"),
                ("Persil", 2, "lot"), ("Coriandre", 2.5, "lot"), ("Oranges", 10, "kg")], 1)]


def test_family_essentials_and_budget():
    request = PanierRequestDTO(budget=210, personnes=5, duree=7)
    products = catalogue()
    result = compose(products, request, {"composition": [{"produit_id": 1, "quantite": .5}]})
    quantities = {item["produit_id"]: item["quantite"] for item in result["composition"]}
    assert quantities[1] >= 4 and quantities[2] >= 3 and quantities[3] >= 2.5
    assert sum(p.prix_kg * quantities.get(p.id, 0) for p in products) <= 210


def test_small_budget_shortens_coverage_and_keeps_essentials():
    result = compose(catalogue(), PanierRequestDTO(budget=100, personnes=6, duree=14))
    assert {1, 2, 3}.issubset({item["produit_id"] for item in result["composition"]})
    assert "jours" in result["_warning"]


def test_large_budget_caps_quantities_and_stock():
    products = catalogue()
    products[3].stock = .2
    request = PanierRequestDTO(budget=5000, personnes=4, duree=7)
    limits = {row["produit_id"]: row["max"] for row in targets(products, 4, 7)}
    result = compose(products, request, {"composition": [{"produit_id": 3, "quantite": 10000}]})
    assert all(item["quantite"] <= limits[item["produit_id"]] for item in result["composition"])
    assert 4 not in limits
    assert sum(item["quantite"] * products[item["produit_id"] - 1].prix_kg for item in result["composition"]) < 500
