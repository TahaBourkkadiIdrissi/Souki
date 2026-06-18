import json
import os
import re
import threading
import unicodedata
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from sqlalchemy.exc import IntegrityError

from config import LocalSession
from dto.panier_dto import LignePanierResponseDTO, PanierRequestDTO, PanierResponseDTO
from entities.product_entity import Product
from interfaces.panier_dao_interface import IPanierDao
from services.panier_service import DELIVERY_FEE, SEUIL_LIVRAISON_GRATUITE, get_product_image


DEFAULT_HF_REPO_ID = "TahaBDI/gemma-2-2b-panier-merged"
VALID_LEVELS = (1, 2, 3)


class MLModelUnavailableError(RuntimeError):
    """Raised when neither the HF model nor the local fallback can produce a basket."""


class MLPanierService:
    """Service d'inference pour le panier intelligent SOUKI."""

    def __init__(self, panier_dao: IPanierDao | None = None) -> None:
        self._lock = threading.Lock()
        self._loaded = False
        self._load_error: str | None = None
        self.panier_dao = panier_dao
        self._fallback_compositions: list[dict[str, Any]] = []

        repo_root = Path(__file__).resolve().parents[2]
        self._fallback_path = Path(
            os.getenv("SOUKI_ML_COMPOSITIONS_PATH", repo_root / "200-compositions.json")
        )
        self._repo_id = os.getenv("SOUKI_ML_REPO_ID", DEFAULT_HF_REPO_ID)
        self._inference_url = os.getenv(
            "SOUKI_ML_INFERENCE_URL",
            f"https://router.huggingface.co/hf-inference/models/{self._repo_id}",
        )
        self._timeout_seconds = float(os.getenv("SOUKI_ML_TIMEOUT_SECONDS", "45"))
        self._preload_timeout_seconds = float(
            os.getenv("SOUKI_ML_PRELOAD_TIMEOUT_SECONDS", str(max(self._timeout_seconds, 180)))
        )

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def load_model(self) -> None:
        """Prepare the HF remote inference configuration and local fallback."""
        with self._lock:
            if self._loaded:
                return

            self._load_fallback_compositions()
            if os.getenv("SOUKI_ML_DISABLE_MODEL", "0") == "1":
                self._load_error = "Chargement HF desactive par SOUKI_ML_DISABLE_MODEL."
            elif not self._get_hf_token():
                self._load_error = "HF_TOKEN manquant pour appeler le modele Hugging Face prive."
            else:
                self._load_error = None
            self._loaded = True

    def warmup_remote_model(self) -> None:
        """Call the remote inference service once so a Space loads the model at startup."""
        if not self._loaded:
            self.load_model()

        if os.getenv("SOUKI_ML_DISABLE_MODEL", "0") == "1":
            return

        token = self._get_hf_token()
        if not token:
            self._load_error = "HF_TOKEN manquant pour precharger le modele Hugging Face."
            return

        body = {
            "inputs": (
                "Retourne uniquement ce JSON valide: "
                '{"composition":[{"produit_id":1,"nom_fr":"Tomates","quantite":1}]}'
            ),
            "parameters": {
                "max_new_tokens": 64,
                "do_sample": False,
                "return_full_text": False,
            },
            "options": {
                "wait_for_model": True,
                "use_cache": False,
            },
        }
        request = Request(
            self._inference_url,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=self._preload_timeout_seconds) as response:
                response.read()
            self._load_error = None
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            self._load_error = self._format_hf_error("Prechargement HF", exc.code, detail)
        except (TimeoutError, URLError) as exc:
            self._load_error = f"Prechargement HF indisponible: {exc}"
        except Exception as exc:
            self._load_error = f"Prechargement HF indisponible: {exc}"

    def unload_model(self) -> None:
        with self._lock:
            self._loaded = False

    def configure_panier_dao(self, panier_dao: IPanierDao) -> None:
        self.panier_dao = panier_dao

    def generer_panier(self, payload: PanierRequestDTO, user_id: int | None = None) -> PanierResponseDTO:
        if not self._loaded:
            self.load_model()

        if self.panier_dao is None:
            raise MLModelUnavailableError("DAO panier non configure pour la generation ML.")

        with LocalSession() as session:
            products = self.panier_dao.get_active_products_for_ml(session)
            if not products:
                raise MLModelUnavailableError("Le catalogue produit est vide.")

            generated = self._generate_with_hugging_face(payload, products)
            source = "huggingface_inference"
            if generated is None:
                if self._is_remote_required():
                    raise MLModelUnavailableError(
                        self._load_error
                        or "Modele Hugging Face requis, mais aucune reponse exploitable n'a ete recue."
                    )
                generated = self._generate_from_fallback(payload)
                source = "dataset_fallback"

            lignes = self._build_response_lines(generated, products, payload)
            if not lignes:
                raise MLModelUnavailableError("Aucun produit exploitable n'a ete genere.")

            panier_id = self._persist_panier(session, user_id, lignes) if user_id else None
            sous_total = round(sum(line.sous_total for line in lignes), 2)
            warning = self._load_error if source == "dataset_fallback" else None
            return PanierResponseDTO(
                status="success",
                source=source,
                panier_id=panier_id,
                criteres={
                    "budget": payload.budget,
                    "personnes": payload.personnes,
                    "duree": payload.duree,
                    "profil": payload.profil,
                    "niveaux": list(VALID_LEVELS),
                },
                lignes_panier=lignes,
                total_dh=sous_total,
                nombre_articles=len(lignes),
                model_warning=warning,
            )

    def _get_hf_token(self) -> str | None:
        return os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN")

    def _is_remote_required(self) -> bool:
        return os.getenv("SOUKI_ML_REQUIRE_REMOTE", "0").strip().lower() in {"1", "true", "yes", "on"}

    def _generate_with_hugging_face(
        self,
        payload: PanierRequestDTO,
        products: list[Product],
    ) -> dict[str, Any] | None:
        if os.getenv("SOUKI_ML_DISABLE_MODEL", "0") == "1":
            return None

        token = self._get_hf_token()
        if not token:
            return None

        prompt = self._build_prompt(payload, products)
        body = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": 700,
                "do_sample": False,
                "return_full_text": False,
            },
            "options": {
                "wait_for_model": True,
                "use_cache": False,
            },
        }
        request = Request(
            self._inference_url,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=self._timeout_seconds) as response:
                raw = response.read().decode("utf-8")
            return self._extract_json_from_hf_response(raw)
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            self._load_error = self._format_hf_error("Inference HF", exc.code, detail)
        except (TimeoutError, URLError) as exc:
            self._load_error = f"Inference HF indisponible: {exc}"
        except Exception as exc:
            self._load_error = f"Inference HF indisponible: {exc}"
        return None

    def _build_prompt(self, payload: PanierRequestDTO, products: list[Product]) -> str:
        catalogue = [
            {
                "produit_id": int(product.id),  # type: ignore[arg-type]
                "nom_fr": str(product.nom_fr),
                "nom_darija": str(product.nom_darija),
                "niveau": int(product.niveau or 2),
                "prix": self._unit_price(product),
                "stock": float(product.stock or 0),
                "unite": str(product.unite),
            }
            for product in products
            if int(product.niveau or 0) in VALID_LEVELS
        ]
        return (
            "Tu es le modele SOUKI de generation de panier automatique.\n"
            "Retourne uniquement un JSON valide, sans markdown, au format:\n"
            '{"composition":[{"produit_id":1,"nom_fr":"Tomates","quantite":1.5}]}\n'
            "Regles strictes: choisir seulement des produits du catalogue, respecter le budget autant "
            "que possible, utiliser les niveaux 1, 2 et 3 si disponibles, quantites positives.\n"
            f"Criteres client: {json.dumps(self._payload_for_model(payload), ensure_ascii=False)}\n"
            f"Catalogue: {json.dumps(catalogue, ensure_ascii=False)}"
        )

    def _payload_for_model(self, payload: PanierRequestDTO) -> dict[str, Any]:
        return {
            "prix_selectionne": payload.budget,
            "nombre_de_personnes": payload.personnes,
            "duree_panier": payload.duree,
            "profil_panier": payload.profil,
        }

    def _extract_json_from_hf_response(self, raw_response: str) -> dict[str, Any] | None:
        try:
            parsed_response = json.loads(raw_response)
        except json.JSONDecodeError:
            parsed_response = raw_response

        if isinstance(parsed_response, list):
            text = " ".join(
                str(item.get("generated_text", item)) if isinstance(item, dict) else str(item)
                for item in parsed_response
            )
        elif isinstance(parsed_response, dict):
            text = str(
                parsed_response.get("generated_text")
                or parsed_response.get("text")
                or parsed_response
            )
        else:
            text = str(parsed_response)

        return self._extract_json(text)

    def _format_hf_error(self, context: str, code: int, detail: str) -> str:
        if "protobuf" in detail.lower():
            if self._is_remote_required():
                return (
                    f"{context} indisponible ({code}): dependance protobuf manquante cote service Hugging Face. "
                    "Modele distant requis, fallback refuse."
                )
            return (
                f"{context} indisponible ({code}): dependance protobuf manquante cote service Hugging Face. "
                "Fallback local actif."
            )
        if "'list' object has no attribute 'keys'" in detail:
            return (
                f"{context} indisponible ({code}): version transformers incompatible cote Space Hugging Face. "
                "Le tokenizer du modele utilise le format transformers v5; mets transformers>=5.12.1 dans le Space."
            )
        return f"{context} indisponible ({code}): {detail[:240]}"

    def _load_fallback_compositions(self) -> None:
        if not self._fallback_path.exists():
            self._fallback_compositions = []
            return
        try:
            self._fallback_compositions = json.loads(
                self._fallback_path.read_text(encoding="utf-8")
            )
        except Exception:
            self._fallback_compositions = []

    def _generate_from_fallback(self, payload: PanierRequestDTO) -> dict[str, Any]:
        if not self._fallback_compositions:
            raise MLModelUnavailableError(
                self._load_error or "Aucun fallback de compositions disponible."
            )

        candidates = [
            item
            for item in self._fallback_compositions
            if item.get("profil_panier") == payload.profil
        ] or self._fallback_compositions

        def score(item: dict[str, Any]) -> float:
            return (
                abs(float(item.get("prix_selectionne", 0)) - payload.budget)
                + abs(int(item.get("nombre_de_personnes", 0)) - payload.personnes) * 15
                + abs(int(item.get("duree_panier", 0)) - payload.duree) * 8
            )

        return min(candidates, key=score)

    def _extract_json(self, generated_text: str) -> dict[str, Any] | None:
        candidates = self._json_object_candidates(generated_text)
        for candidate in reversed(candidates):
            try:
                parsed = json.loads(candidate)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict) and "composition" in parsed:
                return parsed
        return None

    def _json_object_candidates(self, value: str) -> list[str]:
        candidates: list[str] = []
        depth = 0
        start = -1
        in_string = False
        escaped = False

        for index, char in enumerate(value):
            if in_string:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    in_string = False
                continue

            if char == '"':
                in_string = True
                continue

            if char == "{":
                if depth == 0:
                    start = index
                depth += 1
            elif char == "}" and depth > 0:
                depth -= 1
                if depth == 0 and start >= 0:
                    candidates.append(value[start : index + 1])
                    start = -1

        return candidates

    def _build_response_lines(
        self,
        generated: dict[str, Any],
        products: list[Product],
        payload: PanierRequestDTO,
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
        return self._ensure_three_level_basket(lines, products, payload)

    def _ensure_three_level_basket(
        self,
        lines: list[LignePanierResponseDTO],
        products: list[Product],
        payload: PanierRequestDTO,
    ) -> list[LignePanierResponseDTO]:
        available_levels = {
            int(product.niveau or 0)
            for product in products
            if int(product.niveau or 0) in VALID_LEVELS and float(product.stock or 0) > 0
        }
        present_levels = {
            int(getattr(self._product_by_id(products, line.product_id), "niveau", 0) or 0)
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
            quantity = self._suggested_quantity(candidate, remaining_budget)
            line = self._line_for_product(candidate, quantity)
            if line:
                lines.append(line)
                used_ids.add(line.product_id)
                present_levels.add(level)

        return sorted(
            lines,
            key=lambda line: (
                int(getattr(self._product_by_id(products, line.product_id), "niveau", 2) or 2),
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

    def _suggested_quantity(self, product: Product, remaining_budget: float) -> float:
        unit = str(product.unite or "kg").lower()
        price = max(self._unit_price(product), 0.01)
        stock = max(float(product.stock or 0), 0.0)
        step = 1.0 if unit != "kg" else 0.5
        minimum = step

        if remaining_budget > 0:
            affordable = max(minimum, (remaining_budget / max(price, 0.01)) * 0.75)
            quantity = min(affordable, stock or affordable)
        else:
            quantity = min(minimum, stock or minimum)

        if unit == "kg":
            quantity = round(max(minimum, round(quantity / step) * step), 2)
        else:
            quantity = round(max(minimum, round(quantity)), 2)
        return min(quantity, stock) if stock > 0 else quantity

    def _line_for_product(self, product: Product, quantity: float) -> LignePanierResponseDTO | None:
        stock = max(float(product.stock or 0), 0.0)
        effective_quantity = min(quantity, stock) if stock > 0 else quantity
        if effective_quantity <= 0:
            return None

        unit_price = self._unit_price(product)
        subtotal = round(unit_price * effective_quantity, 2)
        return LignePanierResponseDTO(
            product_id=int(product.id),  # type: ignore[arg-type]
            nom_produit=str(product.nom_fr),
            quantite_kg=round(effective_quantity, 2),
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
            raise MLModelUnavailableError("DAO panier non configure pour la persistence ML.")

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

    def _product_by_id(self, products: list[Product], product_id: int) -> Product | None:
        return next((product for product in products if int(product.id) == product_id), None)  # type: ignore[arg-type]

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
