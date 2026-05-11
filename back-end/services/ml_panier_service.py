import json
import os
import threading
from pathlib import Path
from typing import Any

from config import LocalSession
from dto.panier_dto import LignePanierResponseDTO, PanierRequestDTO, PanierResponseDTO
from entities.product_entity import Product
from services.panier_service import get_product_image


class MLModelUnavailableError(RuntimeError):
    """Raised when neither the HF model nor the local fallback can produce a basket."""


class MLPanierService:
    """Service d'inference pour le panier intelligent SOUKI."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._loaded = False
        self._load_error: str | None = None
        self._tokenizer: Any | None = None
        self._model: Any | None = None
        self._torch: Any | None = None
        self._fallback_compositions: list[dict[str, Any]] = []

        repo_root = Path(__file__).resolve().parents[2]
        self._adapter_path = Path(
            os.getenv("SOUKI_ML_ADAPTER_PATH", repo_root / "gemma-2-2b-panier-qlora")
        )
        self._fallback_path = Path(
            os.getenv("SOUKI_ML_COMPOSITIONS_PATH", repo_root / "200-compositions.json")
        )

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def load_model(self) -> None:
        """Charge le modele HF/LoRA une seule fois et garde un fallback local."""
        with self._lock:
            if self._loaded:
                return

            self._load_fallback_compositions()

            if os.getenv("SOUKI_ML_DISABLE_MODEL", "0") == "1":
                self._load_error = "Chargement HF desactive par SOUKI_ML_DISABLE_MODEL."
                self._loaded = True
                return

            try:
                self._load_hugging_face_model()
            except Exception as exc:
                self._load_error = str(exc)
            finally:
                self._loaded = True

    def unload_model(self) -> None:
        with self._lock:
            self._model = None
            self._tokenizer = None
            self._torch = None
            self._loaded = False

    def generer_panier(self, payload: PanierRequestDTO) -> PanierResponseDTO:
        if not self._loaded:
            self.load_model()

        with LocalSession() as session:
            products = session.query(Product).all()
            if not products:
                raise MLModelUnavailableError("Le catalogue produit est vide.")

            generated = self._generate_with_model(payload)
            source = "huggingface_lora"
            if generated is None:
                generated = self._generate_from_fallback(payload)
                source = "dataset_fallback"

            lignes = self._build_response_lines(generated, products)
            if not lignes:
                raise MLModelUnavailableError("Aucun produit exploitable n'a ete genere.")

            total = round(sum(line.sous_total for line in lignes), 2)
            return PanierResponseDTO(
                status="success",
                source=source,
                criteres={
                    "budget": payload.budget,
                    "personnes": payload.personnes,
                    "duree": payload.duree,
                    "profil": payload.profil,
                },
                lignes_panier=lignes,
                total_dh=total,
                nombre_articles=len(lignes),
                model_warning=self._load_error if source == "dataset_fallback" else None,
            )

    def _load_hugging_face_model(self) -> None:
        if not self._adapter_path.exists():
            raise FileNotFoundError(f"Adaptateur LoRA introuvable: {self._adapter_path}")

        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        import torch

        adapter_config_path = self._adapter_path / "adapter_config.json"
        adapter_config = json.loads(adapter_config_path.read_text(encoding="utf-8"))
        base_model_name = os.getenv(
            "SOUKI_ML_BASE_MODEL", adapter_config.get("base_model_name_or_path", "")
        )
        if not base_model_name:
            raise ValueError("base_model_name_or_path manquant dans adapter_config.json")

        local_files_only = os.getenv("SOUKI_ML_LOCAL_FILES_ONLY", "1") != "0"
        os.environ.setdefault("DISABLE_SAFETENSORS_CONVERSION", "1")
        if local_files_only:
            os.environ.setdefault("HF_HUB_OFFLINE", "1")
            os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

        use_cuda = torch.cuda.is_available()
        quantization_config = (
            BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16)
            if use_cuda
            else None
        )

        tokenizer = AutoTokenizer.from_pretrained(
            self._adapter_path,
            local_files_only=local_files_only,
        )
        model_kwargs: dict[str, Any] = {"local_files_only": local_files_only}
        if base_model_name == "sshleifer/tiny-gpt2":
            model_kwargs["use_safetensors"] = False
        if use_cuda:
            model_kwargs["device_map"] = "auto"
        if quantization_config is not None:
            model_kwargs["quantization_config"] = quantization_config

        base_model = AutoModelForCausalLM.from_pretrained(base_model_name, **model_kwargs)
        model = PeftModel.from_pretrained(
            base_model,
            self._adapter_path,
            local_files_only=local_files_only,
        )
        model.eval()

        self._torch = torch
        self._tokenizer = tokenizer
        self._model = model

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

    def _generate_with_model(self, payload: PanierRequestDTO) -> dict[str, Any] | None:
        if self._model is None or self._tokenizer is None or self._torch is None:
            return None

        prompt = (
            "Generate basket for: "
            + json.dumps(
                {
                    "prix_selectionne": payload.budget,
                    "nombre_de_personnes": payload.personnes,
                    "duree_panier": payload.duree,
                    "profil_panier": payload.profil,
                },
                ensure_ascii=False,
            )
            + "\nReturn only valid JSON with a composition array."
        )

        try:
            inputs = self._tokenizer(prompt, return_tensors="pt")
            model_device = getattr(self._model, "device", None)
            if model_device is not None:
                inputs = {key: value.to(model_device) for key, value in inputs.items()}

            with self._torch.inference_mode():
                output_ids = self._model.generate(
                    **inputs,
                    max_new_tokens=512,
                    do_sample=False,
                    pad_token_id=self._tokenizer.eos_token_id,
                )

            generated_text = self._tokenizer.decode(output_ids[0], skip_special_tokens=True)
            return self._extract_json(generated_text)
        except Exception as exc:
            self._load_error = f"Inference HF indisponible: {exc}"
            return None

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
    ) -> list[LignePanierResponseDTO]:
        products_by_id = {int(product.id): product for product in products}  # type: ignore[arg-type]
        products_by_name = {
            self._normalize(str(product.nom_fr)): product
            for product in products
        }

        lignes: list[LignePanierResponseDTO] = []
        for item in generated.get("composition", []):
            product = self._resolve_product(item, products_by_id, products_by_name)
            if product is None:
                continue

            quantity = self._positive_float(
                item.get("quantite") or item.get("quantite_kg") or item.get("quantity")
            )
            if quantity is None:
                continue

            stock = max(float(product.stock or 0), 0.0)  # type: ignore[arg-type]
            effective_quantity = min(quantity, stock) if stock > 0 else quantity
            if effective_quantity <= 0:
                continue

            unit_price = float(product.prix_kg)  # type: ignore[arg-type]
            subtotal = round(unit_price * effective_quantity, 2)
            lignes.append(
                LignePanierResponseDTO(
                    product_id=int(product.id),  # type: ignore[arg-type]
                    nom_produit=str(product.nom_fr),
                    quantite_kg=round(effective_quantity, 2),
                    prix_unitaire=unit_price,
                    sous_total=subtotal,
                    unite=str(product.unite),
                    image=get_product_image(str(product.nom_fr)),
                )
            )

        return lignes

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

        raw_name = item.get("nom_fr") or item.get("nom_produit") or item.get("name")
        if not raw_name:
            return None
        return products_by_name.get(self._normalize(str(raw_name)))

    def _positive_float(self, value: Any) -> float | None:
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        return parsed if parsed > 0 else None

    def _normalize(self, value: str) -> str:
        return (
            value.strip()
            .lower()
            .replace("é", "e")
            .replace("è", "e")
            .replace("ê", "e")
            .replace("à", "a")
            .replace("ç", "c")
        )


ml_panier_service = MLPanierService()
