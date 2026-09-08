from operating_mode import preorders_enabled
import json
import os
import re
import threading
import time
import unicodedata
from typing import Any

from sqlalchemy.exc import IntegrityError

from config import LocalSession
from dto.panier_dto import LignePanierResponseDTO, PanierRequestDTO, PanierResponseDTO
from entities.product_entity import Product
from interfaces.panier_dao_interface import IPanierDao
from services.dish_composition_service import dish_composition_service
from services.panier_service import DELIVERY_FEE, SEUIL_LIVRAISON_GRATUITE, get_product_image

try:  # pragma: no cover - depend de l'environnement
    from groq import Groq
except ImportError:  # pragma: no cover
    Groq = None  # type: ignore[assignment]


DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
VALID_LEVELS = (1, 2, 3)


class MLModelUnavailableError(RuntimeError):
    """Raised when the basket service cannot run at all (no DAO, empty catalogue)."""


class BasketGenerationError(RuntimeError):
    """Raised when Groq cannot produce a valid basket composition after a retry."""


class MLPanierService:
    """Service de generation du panier intelligent SOUKI via Groq (Llama).

    Le panier est genere par prompt engineering: un prompt systeme decrivant le
    catalogue produit en direct + un schema JSON strict est envoye a l'API Groq
    (mode JSON), puis la composition retournee est validee contre le catalogue et
    convertie en lignes de panier. Aucun modele n'est entraine ou fine-tune, et
    aucune base de compositions interne n'est lue.
    """

    def __init__(self, panier_dao: IPanierDao | None = None) -> None:
        self._lock = threading.Lock()
        self.panier_dao = panier_dao

        self._model = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL)
        self._timeout_seconds = float(os.getenv("GROQ_TIMEOUT_SECONDS", "30"))
        self._cache_ttl_seconds = float(os.getenv("SOUKI_PANIER_CACHE_TTL_SECONDS", "600"))
        self._composition_cache: dict[tuple[float, int, int, str], tuple[float, dict[str, Any]]] = {}
        self._client: Any = None

    def configure_panier_dao(self, panier_dao: IPanierDao) -> None:
        self.panier_dao = panier_dao

    # ── Client Groq ────────────────────────────────────────────────────────────
    def _get_client(self) -> Any:
        if self._client is not None:
            return self._client
        if Groq is None:
            raise BasketGenerationError(
                "Le SDK Groq n'est pas installe (pip install groq)."
            )
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise BasketGenerationError("GROQ_API_KEY manquant pour la generation du panier.")
        with self._lock:
            if self._client is None:
                self._client = Groq(api_key=api_key, timeout=self._timeout_seconds)
        return self._client

    # ── Point d'entree public (contrat inchange) ───────────────────────────────
    def generer_panier(self, payload: PanierRequestDTO, user_id: int | None = None) -> PanierResponseDTO:
        if self.panier_dao is None:
            raise MLModelUnavailableError("DAO panier non configure pour la generation.")

        dish = self._resolve_dish(payload)

        with LocalSession() as session:
            products = self.panier_dao.get_active_products_for_ml(session)
            if not products:
                raise MLModelUnavailableError("Le catalogue produit est vide.")

            generated = self._cached_composition(payload)
            if generated is None:
                generated = self.generate_composition_json(payload, products, dish)
                self._store_composition(payload, generated)

            # En mode plat, on garde strictement la composition du plat (pas de
            # rééquilibrage 1/2/3 qui ajouterait des produits hors sujet). Le
            # rééquilibrage n'a de sens que pour le panier « équilibré ».
            lignes = self._build_response_lines(
                generated, products, payload, balance_levels=(dish is None)
            )
            if not lignes:
                raise BasketGenerationError("Aucun produit exploitable n'a ete genere.")

            panier_id = self._persist_panier(session, user_id, lignes) if user_id else None
            sous_total = round(sum(line.sous_total for line in lignes), 2)
            return PanierResponseDTO(
                status="success",
                source="groq_llama",
                panier_id=panier_id,
                criteres={
                    "budget": payload.budget,
                    "personnes": payload.personnes,
                    "duree": payload.duree,
                    "plat": dish["dish_id"] if dish else "equilibre",
                    "niveaux": list(VALID_LEVELS),
                },
                lignes_panier=lignes,
                total_dh=sous_total,
                nombre_articles=len(lignes),
                model_warning=None,
            )

    def _resolve_dish(self, payload: PanierRequestDTO) -> dict[str, Any] | None:
        """Résout le plat marocain choisi (None => panier équilibré).

        Un plat inconnu ou "equilibre" retombe sur le mode équilibré.
        """
        plat = (payload.plat or "").strip()
        if not plat or plat.lower() == "equilibre":
            return None
        return dish_composition_service.get_dish(plat)

    # ── Pipeline Groq ──────────────────────────────────────────────────────────
    def generate_composition_json(
        self,
        payload: PanierRequestDTO,
        products: list[Product],
        dish: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Construit le prompt, appelle Groq et valide la composition.

        `dish` (None => panier équilibré) porte le plat marocain choisi et guide la
        composition. En cas d'echec (appel, JSON invalide ou validation semantique
        KO), reessaie une fois avec un court backoff, puis leve BasketGenerationError.
        """
        system_prompt = self.build_system_prompt(products)
        user_input = self._build_user_input(payload, dish)

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                data = self.call_groq(system_prompt, user_input)
            except BasketGenerationError as exc:
                last_error = exc
            else:
                # La contrainte de répartition 1/2/3 ne s'applique qu'au panier
                # équilibré: un plat/jus peut légitimement tenir sur un seul niveau.
                if self.validate_composition(data, products, require_levels=(dish is None)):
                    return data
                last_error = BasketGenerationError(
                    "Composition Groq invalide (validation semantique echouee)."
                )
            if attempt == 0:
                time.sleep(0.5)

        raise BasketGenerationError(
            f"Generation du panier impossible apres nouvelle tentative: {last_error}"
        )

    def build_system_prompt(self, products: list[Product]) -> str:
        """Assemble instructions + catalogue produit en direct + schema JSON strict.

        Aucun exemple few-shot ni contenu de dataset interne: le prompt s'appuie
        uniquement sur les instructions, le catalogue vivant et le schema.
        """
        catalogue = [
            {
                "produit_id": int(product.id),  # type: ignore[arg-type]
                "nom_fr": str(product.nom_fr),
                "nom_darija": str(product.nom_darija),
                "niveau": int(product.niveau or 2),
                "prix": self._unit_price(product),
                "unite": str(product.unite),
                "stock": float(product.stock or 0),
            }
            for product in products
            if int(product.niveau or 0) in VALID_LEVELS and float(product.stock or 0) > 0
        ]
        return (
            "Tu es le generateur de panier automatique de SOUKI, une epicerie de fruits et legumes.\n"
            "Ta mission: composer un panier a partir UNIQUEMENT du catalogue fourni, selon les criteres du client.\n"
            "\n"
            "Tu dois repondre STRICTEMENT en JSON valide (un seul json object), sans texte ni markdown autour.\n"
            "Schema JSON attendu:\n"
            '{"composition": [{"produit_id": <entier present dans le catalogue>, '
            '"nom_fr": "<nom exact du catalogue>", "quantite": <nombre positif>}]}\n'
            "\n"
            "Regles strictes:\n"
            "- N'utilise QUE des produits presents dans le catalogue (produit_id valide). N'invente jamais de produit.\n"
            "- Budget: la somme des prix*quantite ne doit PAS depasser le budget (au plus ~10% au-dessus). Reste realiste.\n"
            "- quantite strictement positive par PALIERS selon l'unite: en kg, minimum 0.5 et multiples de "
            "0.5 (0.5, 1, 1.5, 2, ...); pour les unites (250g) et les lots, des nombres ENTIERS avec minimum 1.\n"
            "- Echelle par personnes d'abord; la duree n'augmente que moderement les produits qui se conservent "
            "(legumes racines, fruits). NE multiplie PAS par le nombre de jours les herbes, aromates et l'ail: "
            "garde-les proches de leur quantite de base (ex. 1 a 2 lots/unites max).\n"
            "- Les noms peuvent etre reconnus en francais (nom_fr) ou en darija (nom_darija).\n"
            "- Le message utilisateur precise le mode: soit 'panier_equilibre' (varier legumes ET fruits, sur les "
            "niveaux 1/2/3 disponibles), soit 'plat_marocain' avec des ingredients de base a inclure en priorite "
            "et a adapter (n'ajoute alors que des produits vraiment coherents avec ce plat).\n"
            f"\nCatalogue des produits disponibles: {json.dumps(catalogue, ensure_ascii=False)}"
        )

    def _build_user_input(self, payload: PanierRequestDTO, dish: dict[str, Any] | None = None) -> str:
        criteres = {
            "budget_dh": payload.budget,
            "nombre_de_personnes": payload.personnes,
            "duree_jours": payload.duree,
        }
        if dish is None:
            return json.dumps(
                {
                    "mode": "panier_equilibre",
                    "consigne": (
                        "Compose un panier equilibre et varie couvrant a la fois des legumes ET des "
                        "fruits du catalogue, reparti sur les niveaux 1, 2 et 3. IMPORTANT: vise a "
                        "UTILISER la majeure partie du budget (cible ~85-100% du budget_dh), sans "
                        "jamais le depasser. Un budget eleve => panier plus grand et plus varie: "
                        "ajoute DAVANTAGE de produits differents du catalogue et augmente les "
                        "quantites de facon realiste pour t'approcher du budget. N'envoie pas un "
                        "petit panier quand le budget est grand. Adapte au nombre de personnes et a "
                        "la duree (plus de jours => plus de quantite)."
                    ),
                    **criteres,
                },
                ensure_ascii=False,
            )

        base_ingredients = [
            {
                "produit_id": int(ingredient["catalog_product_id"]),
                "nom": str(ingredient["product_reference"]),
                "quantite_base": float(ingredient["quantity"]),
                "unite": str(ingredient.get("unit", "kg")),
            }
            for ingredient in dish.get("ingredients", [])
            if not ingredient.get("missing_from_catalog") and ingredient.get("catalog_product_id")
        ]
        return json.dumps(
            {
                "mode": "plat_marocain",
                "plat": {
                    "nom_fr": dish["name_fr"],
                    "nom_darija": dish["name_darija"],
                    "categorie": dish["category"],
                    "portions_de_base": int(dish.get("default_servings", 4)),
                },
                "ingredients_de_base_du_plat": base_ingredients,
                "consigne": (
                    "Compose le panier STRICTEMENT a partir de ingredients_de_base_du_plat: n'utilise QUE "
                    "ces produits, sans AUCUN produit etranger au plat. Les quantite_base valent pour "
                    "portions_de_base personnes: la SEULE variable est le nombre de personnes — mets a "
                    "l'echelle chaque quantite par le ratio (nombre_de_personnes / portions_de_base). "
                    "Ni le budget ni la duree ne s'appliquent a un plat: vise des quantites justes pour le "
                    "nombre de personnes. Exemple: pour un jus d'orange, uniquement des oranges (+ un peu "
                    "de citron), jamais de pomme de terre, salade, persil ou autre produit sans rapport."
                ),
                # Un plat ne dépend que du nombre de personnes (ni budget ni durée).
                "nombre_de_personnes": payload.personnes,
            },
            ensure_ascii=False,
        )

    def call_groq(self, system_prompt: str, user_input: str) -> dict[str, Any]:
        """Appelle l'endpoint chat/completions de Groq en mode JSON."""
        client = self._get_client()
        try:
            response = client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_input},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            content = response.choices[0].message.content
        except Exception as exc:  # erreurs reseau/API/SDK Groq
            raise BasketGenerationError(f"Appel Groq echoue: {exc}") from exc

        try:
            data = json.loads(content or "")
        except (json.JSONDecodeError, TypeError) as exc:
            raise BasketGenerationError(f"Reponse Groq non parsable en JSON: {exc}") from exc
        if not isinstance(data, dict):
            raise BasketGenerationError("Reponse Groq inattendue (JSON non-objet).")
        return data

    def validate_composition(
        self,
        data: dict[str, Any],
        products: list[Product],
        require_levels: bool = True,
    ) -> bool:
        """Valide la sortie Groq contre le catalogue en direct.

        Verifie la structure, la validite des produits references et les quantites
        positives. Avec require_levels=True (panier équilibré), exige aussi une
        répartition sur au moins deux niveaux; en mode plat, un seul niveau suffit.
        Ne lit aucun dataset interne.
        """
        composition = data.get("composition")
        if not isinstance(composition, list) or not composition:
            return False

        products_by_id = {int(product.id): product for product in products}  # type: ignore[arg-type]
        products_by_name = {self._normalize(str(product.nom_fr)): product for product in products}
        products_by_name.update(
            {self._normalize(str(product.nom_darija)): product for product in products}
        )
        available_levels = {
            int(product.niveau or 0)
            for product in products
            if int(product.niveau or 0) in VALID_LEVELS and float(product.stock or 0) > 0
        }

        seen_levels: set[int] = set()
        valid_items = 0
        for item in composition:
            if not isinstance(item, dict):
                continue
            product = self._resolve_product(item, products_by_id, products_by_name)
            if product is None:
                continue
            quantity = self._positive_float(
                item.get("quantite") or item.get("quantite_kg") or item.get("quantity")
            )
            if quantity is None:
                continue
            valid_items += 1
            seen_levels.add(int(product.niveau or 0))

        if valid_items == 0:
            return False

        # Distribution: au moins deux niveaux representes quand le catalogue en
        # propose au moins deux (le backfill garantit ensuite le troisieme niveau).
        # Ignorée en mode plat: un plat/jus peut tenir sur un seul niveau.
        if require_levels:
            required_levels = min(len(available_levels & set(VALID_LEVELS)), 2)
            if len(seen_levels & set(VALID_LEVELS)) < required_levels:
                return False
        return True

    # ── Cache TTL des compositions ─────────────────────────────────────────────
    def _cache_key(self, payload: PanierRequestDTO) -> tuple[float, int, int, str]:
        plat = (payload.plat or "equilibre").strip() or "equilibre"
        return (float(payload.budget), int(payload.personnes), int(payload.duree), plat)

    def _cached_composition(self, payload: PanierRequestDTO) -> dict[str, Any] | None:
        if self._cache_ttl_seconds <= 0:
            return None
        with self._lock:
            entry = self._composition_cache.get(self._cache_key(payload))
            if entry is None:
                return None
            stored_at, composition = entry
            if time.monotonic() - stored_at > self._cache_ttl_seconds:
                self._composition_cache.pop(self._cache_key(payload), None)
                return None
            return composition

    def _store_composition(self, payload: PanierRequestDTO, composition: dict[str, Any]) -> None:
        if self._cache_ttl_seconds <= 0:
            return
        now = time.monotonic()
        with self._lock:
            self._composition_cache = {
                key: (stored_at, value)
                for key, (stored_at, value) in self._composition_cache.items()
                if now - stored_at <= self._cache_ttl_seconds
            }
            self._composition_cache[self._cache_key(payload)] = (now, composition)

    # ── Construction des lignes de panier ──────────────────────────────────────
    def _build_response_lines(
        self,
        generated: dict[str, Any],
        products: list[Product],
        payload: PanierRequestDTO,
        balance_levels: bool = True,
    ) -> list[LignePanierResponseDTO]:
        products_by_id = {int(product.id): product for product in products}  # type: ignore[arg-type]
        products_by_name = {self._normalize(str(product.nom_fr)): product for product in products}
        products_by_name.update(
            {self._normalize(str(product.nom_darija)): product for product in products}
        )

        lines_by_product_id: dict[int, LignePanierResponseDTO] = {}
        for item in generated.get("composition", []):
            if not isinstance(item, dict):
                continue
            product = self._resolve_product(item, products_by_id, products_by_name)
            if product is None:
                continue

            quantity = self._positive_float(
                item.get("quantite") or item.get("quantite_kg") or item.get("quantity")
            )
            if quantity is None:
                continue

            line = self._line_for_product(product, quantity)
            if line is None:
                continue
            existing = lines_by_product_id.get(line.product_id)
            if existing:
                merged_quantity = min(
                    existing.quantite_kg + line.quantite_kg,
                    float(product.stock or existing.quantite_kg),
                )
                lines_by_product_id[line.product_id] = self._line_for_product(product, merged_quantity) or existing
            else:
                lines_by_product_id[line.product_id] = line

        lines = list(lines_by_product_id.values())
        if not balance_levels:
            return sorted(
                lines,
                key=lambda line: (
                    int(getattr(products_by_id.get(line.product_id), "niveau", 2) or 2),
                    line.product_id,
                ),
            )
        lines = self._ensure_three_level_basket(lines, products, products_by_id, payload)
        # Mode équilibré: le budget est une cible d'achat. On complète le panier
        # (variété puis quantités) pour s'approcher du budget si Groq est resté en
        # dessous, en respectant stock et paliers.
        lines = self._fill_to_budget(lines, products, products_by_id, payload)
        return sorted(
            lines,
            key=lambda line: (
                int(getattr(products_by_id.get(line.product_id), "niveau", 2) or 2),
                line.product_id,
            ),
        )

    # Part minimale du budget qu'un panier équilibré doit viser à atteindre.
    _BUDGET_FILL_TARGET = 0.85
    # Facteur d'échelle maximal (garde-fou anti-emballement; la cible budget borne déjà).
    _BUDGET_FILL_MAX_FACTOR = 8.0

    def _fill_to_budget(
        self,
        lines: list[LignePanierResponseDTO],
        products: list[Product],
        products_by_id: dict[int, Product],
        payload: PanierRequestDTO,
    ) -> list[LignePanierResponseDTO]:
        target = max(float(payload.budget), 0.0)
        floor = target * self._BUDGET_FILL_TARGET

        def total() -> float:
            return sum(line.sous_total for line in lines)

        # Déjà dans la fourchette acceptable [~85%, 100%] du budget: on respecte les
        # quantités du modèle sans rien retoucher.
        if target <= 0 or floor <= total() <= target:
            return lines

        used_ids = {line.product_id for line in lines}

        # 1) Variété (seulement si SOUS le budget): ajoute des produits du catalogue
        #    encore absents (du moins cher au plus cher) tant qu'on est sous la cible.
        if total() < floor:
            candidates = sorted(
                (
                    product
                    for product in products
                    if int(product.id) not in used_ids  # type: ignore[arg-type]
                    and float(product.stock or 0) > 0
                    and int(product.niveau or 0) in VALID_LEVELS
                ),
                key=lambda product: self._unit_price(product),
            )
            for product in candidates:
                if total() >= floor:
                    break
                remaining = max(target - total(), 0.0)
                quantity = self._fill_quantity(product, remaining)
                line = self._line_for_product(product, quantity)
                if line and total() + line.sous_total <= target:
                    lines.append(line)
                    used_ids.add(line.product_id)

        # 2) Mise à l'échelle des seules lignes en kg (elles varient en continu et gardent
        #    des décimales exactes). Objectif: rester dans une fourchette raisonnable du
        #    budget. On ne touche à rien tant que le panier est déjà entre ~85% et 100% du
        #    budget (on respecte alors les quantités du modèle). Sinon on ajuste vers ~97%
        #    (remplissage) ou juste sous le budget (si le modèle a dépassé). Les lots/unités
        #    (entiers, choisis par le modèle) ne sont jamais modifiés.
        current = total()
        if current < floor or current > target:
            kg_lines = [
                (index, line)
                for index, line in enumerate(lines)
                if products_by_id.get(line.product_id) is not None
                and str(products_by_id[line.product_id].unite or "kg").lower() == "kg"
            ]
            kg_total = sum(line.sous_total for _, line in kg_lines)
            if kg_total > 0:
                # Marge sous le budget car l'arrondi aux paliers de 0.5 kg peut remonter le total.
                aim = target * (0.90 if current < floor else 0.85)
                desired_kg_total = aim - (current - kg_total)
                factor = min(
                    max(desired_kg_total / kg_total, 0.05),
                    self._BUDGET_FILL_MAX_FACTOR,
                )
                for index, line in kg_lines:
                    product = products_by_id[line.product_id]
                    lines[index] = self._line_for_product(product, line.quantite_kg * factor) or line

        return lines

    def _ensure_three_level_basket(
        self,
        lines: list[LignePanierResponseDTO],
        products: list[Product],
        products_by_id: dict[int, Product],
        payload: PanierRequestDTO,
    ) -> list[LignePanierResponseDTO]:
        available_levels = {
            int(product.niveau or 0)
            for product in products
            if int(product.niveau or 0) in VALID_LEVELS and float(product.stock or 0) > 0
        }
        present_levels = {
            int(getattr(products_by_id.get(line.product_id), "niveau", 0) or 0)
            for line in lines
        }
        used_ids = {line.product_id for line in lines}
        target_total = max(float(payload.budget), 1.0)

        for level in VALID_LEVELS:
            if level not in available_levels or level in present_levels:
                continue
            candidate = self._best_level_candidate(products, level, used_ids, target_total)
            if not candidate:
                continue
            remaining_budget = max(target_total - sum(line.sous_total for line in lines), 0.0)
            quantity = self._fill_quantity(candidate, remaining_budget)
            line = self._line_for_product(candidate, quantity)
            if line:
                lines.append(line)
                used_ids.add(line.product_id)
                present_levels.add(level)

        return sorted(
            lines,
            key=lambda line: (
                int(getattr(products_by_id.get(line.product_id), "niveau", 2) or 2),
                line.product_id,
            ),
        )

    def _best_level_candidate(
        self,
        products: list[Product],
        level: int,
        used_ids: set[int],
        budget: float,
    ) -> Product | None:
        candidates = [
            product
            for product in products
            if int(product.niveau or 0) == level
            and int(product.id) not in used_ids  # type: ignore[arg-type]
            and float(product.stock or 0) > 0
        ]
        if not candidates:
            return None

        return min(
            candidates,
            key=lambda product: (
                0 if self._unit_price(product) <= budget else 1,
                self._unit_price(product),
                int(product.id),  # type: ignore[arg-type]
            ),
        )

    def _fill_quantity(self, product: Product, remaining_budget: float) -> float:
        """Quantité de base modeste pour un produit ajouté au remplissage/backfill.

        Une base réaliste (≈1.5 kg, ou 1 unité/lot), plafonnée par ce que le budget
        restant permet — la mise à l'échelle proportionnelle fait ensuite le reste.
        Aucune sur-quantité dictée par un gros budget.
        """
        unit = str(product.unite or "kg").lower()
        base = 1.5 if unit == "kg" else 1.0
        price = max(self._unit_price(product), 0.01)
        if remaining_budget <= 0:
            return base
        return max(0.0, min(base, remaining_budget / price))

    def _line_for_product(self, product: Product, quantity: float) -> LignePanierResponseDTO | None:
        stock = max(float(product.stock or 0), 0.0)
        effective_quantity = min(quantity, stock) if stock > 0 and not preorders_enabled() else quantity
        if effective_quantity <= 0:
            return None

        # Quantites par paliers selon l'unite du produit:
        #  - kg     : minimum 0.5 kg, pas de 0.5 kg (0.5, 1.0, 1.5, ...)
        #  - 250g   : minimum 1 (= 250 g), pas de 1
        #  - lot    : minimum 1 lot, pas de 1 lot
        unit = str(product.unite or "kg").lower()
        if unit == "kg":
            final_quantity = max(0.5, round(effective_quantity / 0.5) * 0.5)
            if stock > 0 and not preorders_enabled():
                max_pal = int(stock / 0.5) * 0.5
                if max_pal >= 0.5:
                    final_quantity = min(final_quantity, max_pal)
        else:
            final_quantity = float(max(1, round(effective_quantity)))
            if stock > 0 and not preorders_enabled():
                final_quantity = min(final_quantity, float(int(stock)) or final_quantity)
        if final_quantity <= 0:
            return None

        unit_price = self._unit_price(product)
        subtotal = round(unit_price * final_quantity, 2)
        return LignePanierResponseDTO(
            product_id=int(product.id),  # type: ignore[arg-type]
            nom_produit=str(product.nom_fr),
            quantite_kg=final_quantity,
            prix_unitaire=unit_price,
            sous_total=subtotal,
            unite=str(product.unite),
            image=str(product.image_url) if product.image_url else get_product_image(str(product.nom_fr)),
        )

    def _persist_panier(
        self,
        session,
        user_id: int | None,
        lignes: list[LignePanierResponseDTO],
    ) -> int | None:
        if user_id is None:
            return None

        sous_total = round(sum(line.sous_total for line in lignes), 2)
        total_legumes = round(sum(line.quantite_kg for line in lignes), 2)
        frais_livraison = 0.0 if sous_total >= SEUIL_LIVRAISON_GRATUITE else DELIVERY_FEE
        montant_total = round(sous_total + frais_livraison, 2)

        if self.panier_dao is None:
            raise MLModelUnavailableError("DAO panier non configure pour la persistence.")

        panier = self.panier_dao.create_panier_draft(
            session=session,
            user_id=user_id,
            total_legumes=total_legumes,
            total_facture=montant_total,
        )
        try:
            with session.begin_nested():
                self.panier_dao.create_commande_draft(
                    session=session,
                    client_id=user_id,
                    panier_id=int(panier.id),  # type: ignore[arg-type]
                    montant_total=montant_total,
                )
        except IntegrityError:
            pass

        for line in lignes:
            self.panier_dao.create_ligne_panier(
                session=session,
                panier_id=int(panier.id),  # type: ignore[arg-type]
                produit_id=line.product_id,
                quantite_kg=line.quantite_kg,
                sous_total=line.sous_total,
            )
        session.commit()
        return int(panier.id)  # type: ignore[arg-type]

    def _resolve_product(
        self,
        item: dict[str, Any],
        products_by_id: dict[int, Product],
        products_by_name: dict[str, Product],
    ) -> Product | None:
        raw_id = item.get("produit_id") or item.get("product_id") or item.get("id")
        try:
            product_id = int(raw_id)
        except (TypeError, ValueError):
            product_id = 0

        if product_id in products_by_id:
            return products_by_id[product_id]

        raw_name = (
            item.get("nom_fr")
            or item.get("nom_produit")
            or item.get("produit_fr")
            or item.get("name")
            or item.get("produit")
        )
        if not raw_name:
            return None
        normalized_name = self._normalize(str(raw_name))
        if normalized_name in products_by_name:
            return products_by_name[normalized_name]

        for key, product in products_by_name.items():
            if normalized_name in key or key in normalized_name:
                return product
        return None

    def _unit_price(self, product: Product) -> float:
        prix_affiche = getattr(product, "prix_affiche", None)
        return round(float(prix_affiche if prix_affiche is not None else product.prix_kg), 2)  # type: ignore[arg-type]

    def _positive_float(self, value: Any) -> float | None:
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        return parsed if parsed > 0 else None

    def _normalize(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
        normalized = re.sub(r"[^a-zA-Z0-9]+", " ", normalized.lower()).strip()
        return re.sub(r"\s+", " ", normalized)


ml_panier_service = MLPanierService()
