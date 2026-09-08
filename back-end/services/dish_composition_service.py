from operating_mode import preorders_enabled
"""Couche de renforcement deterministe: 100 compositions de plats marocains.

Cette couche est independante du pipeline de generation IA du panier (aucun appel LLM):
- correspondance nom de plat -> composition (voix/texte et selection manuelle),
- resolution des ingredients contre le catalogue reel via product_dao,
- mise a l'echelle des quantites par nombre de personnes.
"""

import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Optional

from config import LocalSession
from dto.panier_dto import DishCompositionResponseDTO, DishSummaryDTO, LignePanierResponseDTO
from entities.product_entity import Product
from interfaces.product_dao_interface import IProductDao
from services.panier_service import get_product_image


DEFAULT_DATASET_PATH = Path(__file__).resolve().parents[1] / "data" / "plats-marocains.json"

# Mots vides retires avant la mise en correspondance des noms de plats,
# pour que "je veux faire un tajine de poulet" matche "tajine poulet".
_STOPWORDS = {
    "a", "au", "aux", "avec", "b", "bel", "bla", "de", "des", "dial", "du", "dyal",
    "en", "et", "l", "la", "le", "les", "un", "une",
    "je", "tu", "il", "on", "nous", "vous", "veux", "voudrais", "svp",
    "faire", "cuisiner", "preparer", "prepare", "recette", "plat", "pour", "ce", "soir",
}


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-zA-Z0-9]+", " ", normalized.lower()).strip()
    return re.sub(r"\s+", " ", normalized)


def _strip_stopwords(normalized: str) -> str:
    return " ".join(token for token in normalized.split() if token not in _STOPWORDS)


class DishCompositionService:
    """Service de composition de plats marocains (couche code, hors modele ML)."""

    def __init__(self, product_dao: IProductDao | None = None, dataset_path: Path | None = None) -> None:
        self.product_dao = product_dao
        self._dataset_path = dataset_path or DEFAULT_DATASET_PATH
        self._dishes: list[dict[str, Any]] | None = None
        self._match_index: list[tuple[str, str]] | None = None

    # ── Chargement ────────────────────────────────────────────────────────────
    def _load(self) -> list[dict[str, Any]]:
        if self._dishes is None:
            raw = json.loads(self._dataset_path.read_text(encoding="utf-8"))
            dishes = []
            seen_ids: set[str] = set()
            for entry in raw:
                if not isinstance(entry, dict):
                    continue
                dish_id = str(entry.get("dish_id", "")).strip()
                if not dish_id or dish_id in seen_ids or not entry.get("ingredients"):
                    continue
                seen_ids.add(dish_id)
                dishes.append(entry)
            self._dishes = dishes
        return self._dishes

    def _index(self) -> list[tuple[str, str]]:
        """Candidats de correspondance (texte normalise sans mots vides -> dish_id),
        tries du plus long au plus court pour que le match le plus specifique gagne."""
        if self._match_index is None:
            index: list[tuple[str, str]] = []
            for dish in self._load():
                candidates = {dish["name_fr"], dish["name_darija"], *dish.get("aliases", [])}
                for candidate in candidates:
                    stripped = _strip_stopwords(_normalize(str(candidate)))
                    if len(stripped) >= 4:
                        index.append((stripped, dish["dish_id"]))
            index.sort(key=lambda pair: len(pair[0]), reverse=True)
            self._match_index = index
        return self._match_index

    # ── API publique ──────────────────────────────────────────────────────────
    def list_dishes(self, only_with_available_ingredients: bool = False) -> list[DishSummaryDTO]:
        """Liste des plats. Avec only_with_available_ingredients=True (dropdown du
        panier IA), les plats dont AUCUN ingredient n'est un produit actif du
        catalogue sont exclus — la reconnaissance vocale, elle, garde les 100 plats."""
        dishes = self._load()
        if only_with_available_ingredients:
            with LocalSession() as session:
                active_ids = {
                    int(product_id)
                    for (product_id,) in session.query(Product.id).filter(Product.is_active == True).all()  # noqa: E712
                }
            dishes = [
                dish
                for dish in dishes
                if any(
                    not ingredient.get("missing_from_catalog")
                    and ingredient.get("catalog_product_id") in active_ids
                    for ingredient in dish["ingredients"]
                )
            ]
        return [
            DishSummaryDTO(
                dish_id=dish["dish_id"],
                name_fr=dish["name_fr"],
                name_darija=dish["name_darija"],
                category=dish["category"],
            )
            for dish in dishes
        ]

    def get_dish(self, dish_id: str) -> Optional[dict[str, Any]]:
        return next((dish for dish in self._load() if dish["dish_id"] == dish_id), None)

    def match_dish(self, text: str) -> Optional[dict[str, Any]]:
        """Detecte un plat connu dans un texte libre (fr ou darija)."""
        stripped_text = f" {_strip_stopwords(_normalize(text))} "
        if not stripped_text.strip():
            return None
        for candidate, dish_id in self._index():
            if f" {candidate} " in stripped_text:
                return self.get_dish(dish_id)
        return None

    @staticmethod
    def parse_personnes(text: str) -> Optional[int]:
        match = re.search(r"pour\s+(\d{1,2})\s+personnes?", _normalize(text))
        if match:
            value = int(match.group(1))
            if 1 <= value <= 8:
                return value
        return None

    def scale_quantity(self, quantity: float, unit: str, factor: float) -> float:
        scaled = quantity * factor
        if str(unit).lower() == "kg":
            return max(0.1, round(scaled, 2))
        # lots, 250g, unites: pas de fraction achetable
        return max(1.0, float(round(scaled)))

    def resolve_composition(self, dish_id: str, personnes: int) -> Optional[DishCompositionResponseDTO]:
        """Resout un plat en lignes panier (produits actifs, stock plafonne, prix reels)."""
        dish = self.get_dish(dish_id)
        if dish is None:
            return None

        factor = personnes / max(int(dish.get("default_servings", 4)), 1)
        lignes: list[LignePanierResponseDTO] = []
        manquants: list[str] = []

        with LocalSession() as session:
            for ingredient in dish["ingredients"]:
                reference = str(ingredient["product_reference"])
                if ingredient.get("missing_from_catalog"):
                    # Jamais resolu par alias: le matching par inclusion transformerait
                    # "citron confit" en Citrons ou "fleur d'oranger" en Oranges.
                    manquants.append(reference)
                    continue

                product = self._resolve_product(session, ingredient)
                if product is None:
                    manquants.append(reference)
                    continue

                quantity = self.scale_quantity(float(ingredient["quantity"]), str(product.unite), factor)
                stock = max(float(product.stock or 0), 0.0)
                if not preorders_enabled() and stock <= 0:
                    manquants.append(reference)
                    continue
                if not preorders_enabled():
                    quantity = min(quantity, stock)

                unit_price = self._unit_price(product)
                lignes.append(
                    LignePanierResponseDTO(
                        product_id=int(product.id),  # type: ignore[arg-type]
                        nom_produit=str(product.nom_fr),
                        quantite_kg=round(quantity, 2),
                        prix_unitaire=unit_price,
                        sous_total=round(unit_price * quantity, 2),
                        unite=str(product.unite),
                        image=str(product.image_url) if product.image_url else get_product_image(str(product.nom_fr)),
                    )
                )

        return DishCompositionResponseDTO(
            status="success",
            dish_id=dish["dish_id"],
            name_fr=dish["name_fr"],
            name_darija=dish["name_darija"],
            category=dish["category"],
            personnes=personnes,
            default_servings=int(dish.get("default_servings", 4)),
            lignes_panier=lignes,
            ingredients_manquants=manquants,
            total_dh=round(sum(line.sous_total for line in lignes), 2),
            nombre_articles=len(lignes),
        )

    def items_for_text(self, text: str) -> Optional[dict[str, Any]]:
        """Pre-check voix/texte: si le texte designe un plat connu, retourne les
        items prets pour le pipeline de validation existant (valider_et_ajuster_item)
        et les ingredients hors catalogue a afficher comme indisponibles."""
        dish = self.match_dish(text)
        if dish is None:
            return None

        personnes = self.parse_personnes(text) or int(dish.get("default_servings", 4))
        factor = personnes / max(int(dish.get("default_servings", 4)), 1)

        items: list[dict[str, Any]] = []
        manquants: list[str] = []
        for ingredient in dish["ingredients"]:
            if ingredient.get("missing_from_catalog"):
                manquants.append(str(ingredient["product_reference"]))
                continue
            items.append(
                {
                    "produit_fr": str(ingredient["product_reference"]),
                    "quantite": self.scale_quantity(
                        float(ingredient["quantity"]), str(ingredient.get("unit", "kg")), factor
                    ),
                }
            )

        return {
            "dish": dish,
            "personnes": personnes,
            "items": items,
            "ingredients_manquants": manquants,
        }

    # ── Interne ───────────────────────────────────────────────────────────────
    def _resolve_product(self, session, ingredient: dict[str, Any]) -> Optional[Product]:
        product_id = ingredient.get("catalog_product_id")
        if product_id is not None:
            product = session.query(Product).filter(Product.id == int(product_id)).first()
            if product is not None and bool(product.is_active):
                return product
        # Repli si l'admin a recree le produit sous un autre id.
        if self.product_dao is not None:
            return self.product_dao.get_by_alias(session, str(ingredient["product_reference"]))
        return None

    def _unit_price(self, product: Product) -> float:
        prix_affiche = getattr(product, "prix_affiche", None)
        return round(float(prix_affiche if prix_affiche is not None else product.prix_kg), 2)  # type: ignore[arg-type]


dish_composition_service = DishCompositionService()
