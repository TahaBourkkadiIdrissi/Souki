import re
import threading
import time
import unicodedata
from typing import Any, List, Optional

from sqlalchemy.orm import Session

from entities.product_entity import Product
from interfaces.product_dao_interface import IProductDao


class ProductDaoBD(IProductDao):

    # Cache process-wide des alias normalises (le DAO est instancie a chaque requete
    # FastAPI, d'ou un etat de classe). TTL court + invalidation explicite sur les
    # mutations produit (create/reactivate/deactivate/delete).
    _ALIAS_CACHE_TTL_SECONDS = 60.0
    _alias_cache_lock = threading.Lock()
    _alias_cache: Optional[dict[str, Any]] = None

    @classmethod
    def invalidate_alias_cache(cls) -> None:
        with cls._alias_cache_lock:
            cls._alias_cache = None

    def _normalize_alias(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
        normalized = re.sub(r"[^a-zA-Z0-9]+", " ", normalized.lower()).strip()
        return re.sub(r"\s+", " ", normalized)

    def _singularize(self, value: str) -> str:
        if value.endswith("s") and len(value) > 3:
            return value[:-1]
        return value

    def _build_aliases(self, product: Product) -> set[str]:
        aliases = {
            self._normalize_alias(str(product.nom_fr)),
            self._normalize_alias(str(product.nom_darija)),
        }
        aliases |= {self._singularize(alias) for alias in list(aliases)}

        extra_aliases = {
            "pommes de terre": {"pomme de terre"},
            "oignons rouge": {"oignon rouge", "oignons rouges", "bassla"},
            "piments": {"piment"},
            "tomates": {"tomate"},
            "carottes": {"carotte"},
            "courgettes": {"courgette"},
            "aubergines": {"aubergine"},
            "concombres": {"concombre"},
            "oranges": {"orange"},
            "citrons": {"citron", "limon"},
            "poivrons": {"poivron"},
            "haricots verts": {"haricot vert"},
            "epinards": {"epinard"},
            "betteraves": {"betterave"},
            "navets": {"navet"},
            "petit pois": {"petits pois", "petit pois frais", "petit-pois"},
            "chou fleur": {"choufleur"},
        }
        product_name = self._normalize_alias(str(product.nom_fr))
        aliases |= {
            self._normalize_alias(alias)
            for alias in extra_aliases.get(product_name, set())
        }
        return {alias for alias in aliases if alias}

    def _get_alias_index(self, session: Session) -> dict[str, Any]:
        cls = type(self)
        now = time.monotonic()
        with cls._alias_cache_lock:
            cache = cls._alias_cache
            if cache is not None and now - cache["built_at"] < cls._ALIAS_CACHE_TTL_SECONDS:
                return cache

            exact: dict[str, int] = {}
            entries: list[tuple[set[str], int]] = []
            for product in (
                session.query(Product).filter(Product.is_active == True).all()  # noqa: E712
            ):
                aliases = self._build_aliases(product)
                product_id = int(product.id)  # type: ignore[arg-type]
                entries.append((aliases, product_id))
                for candidate in aliases:
                    exact.setdefault(candidate, product_id)

            cache = {"built_at": now, "exact": exact, "entries": entries}
            cls._alias_cache = cache
            return cache

    @staticmethod
    def _lookup_alias_index(
        index: dict[str, Any], normalized_alias: str, singular_alias: str
    ) -> Optional[int]:
        product_id = index["exact"].get(normalized_alias)
        if product_id is None:
            product_id = index["exact"].get(singular_alias)
        if product_id is not None:
            return int(product_id)
        for aliases, candidate_id in index["entries"]:
            if any(
                normalized_alias in candidate or candidate in normalized_alias
                for candidate in aliases
            ):
                return int(candidate_id)
        return None

    def get_by_alias(self, session: Session, alias: str) -> Optional[Product]:
        normalized_alias = self._normalize_alias(alias)
        singular_alias = self._singularize(normalized_alias)

        for _attempt in range(2):
            index = self._get_alias_index(session)
            product_id = self._lookup_alias_index(index, normalized_alias, singular_alias)
            if product_id is None:
                return None
            product = (
                session.query(Product)
                .filter(Product.id == product_id, Product.is_active == True)  # noqa: E712
                .first()
            )
            if product is not None:
                return product
            # Cache perime (produit renomme/desactive entre-temps) : rebuild puis retry.
            type(self).invalidate_alias_cache()
        return None

    def get_all(self, session: Session) -> List[Product]:
        return (
            session.query(Product)
            .filter(Product.is_active == True)  # noqa: E712
            .filter(~Product.nom_fr.ilike("Tomate test"))
            .filter(~Product.nom_fr.ilike("Taha"))
            .filter(~Product.nom_fr.ilike("Hamza"))
            .filter(~Product.nom_darija.ilike("Tomate test"))
            .filter(~Product.nom_darija.ilike("Taha"))
            .filter(~Product.nom_darija.ilike("Hamza"))
            .order_by(Product.id.asc())
            .all()
        )

    def get_suggestions(
        self,
        session: Session,
        exclude_ids: list[int],
        panier_total: float = 0.0,
        seuil: float = 300.0,
        limit: int = 4,
    ) -> List[Product]:
        reste = max(0, seuil - panier_total)
        query = (
            session.query(Product)
            .filter(Product.niveau.in_([2, 3]))
            .filter(Product.is_active == True)  # noqa: E712
            .filter(Product.prix_affiche.isnot(None))
            .filter(Product.stock > 0)
            .filter(~Product.nom_fr.ilike("Tomate test"))
            .filter(~Product.nom_fr.ilike("Taha"))
            .filter(~Product.nom_fr.ilike("Hamza"))
            .filter(~Product.nom_darija.ilike("Tomate test"))
            .filter(~Product.nom_darija.ilike("Taha"))
            .filter(~Product.nom_darija.ilike("Hamza"))
        )
        if exclude_ids:
            query = query.filter(Product.id.notin_(exclude_ids))
        produits = query.all()

        def score(produit: Product) -> float:
            prix_affiche = float(produit.prix_affiche or 0)
            niveau = int(produit.niveau or 0)
            marge = {2: 24, 3: 42}.get(niveau, 0)
            complete_seuil = 28 if reste > 0 and prix_affiche >= reste else 0
            prix_confort = 12 if 0 < reste and prix_affiche <= max(reste + 15, 20) else 0
            aventure = 10 if any(
                mot in self._normalize_alias(str(produit.nom_fr))
                for mot in ["menthe", "coriandre", "persil", "citron", "brocoli", "poivron"]
            ) else 0
            return marge + complete_seuil + prix_confort + aventure

        suggestions = sorted(produits, key=score, reverse=True)
        top_level_three = [p for p in suggestions if int(p.niveau or 0) == 3]
        top_level_two = [p for p in suggestions if int(p.niveau or 0) == 2]
        balanced = []
        for candidate in [*top_level_three[:2], *top_level_two[:2], *suggestions]:
            if candidate not in balanced:
                balanced.append(candidate)
            if len(balanced) >= limit:
                break
        return balanced

    def get_personalized_suggestions(
        self,
        session: Session,
        favorite_ids: set[int],
        ordered_freq: dict[int, int],
        exclude_ids: list[int],
        panier_total: float = 0.0,
        limit: int = 8,
    ) -> List[Product]:
        """Suggestions personnalisees = favoris + produits deja commandes en tete,
        completees par les suggestions generiques.

        Un favori est priorise sur un simple achat ; a favori egal, on classe par
        frequence d'achat. Le reste est comble avec `get_suggestions` (marge/seuil/
        decouverte), en excluant ce qui a deja ete retenu.
        """
        excluded = set(exclude_ids or [])
        personalized_ids = (set(favorite_ids) | set(ordered_freq.keys())) - excluded

        chosen: List[Product] = []
        if personalized_ids:
            produits = (
                session.query(Product)
                .filter(Product.id.in_(personalized_ids))
                .filter(Product.is_active == True)  # noqa: E712
                .filter(Product.stock > 0)
                .all()
            )

            def personal_score(produit: Product) -> tuple[int, int]:
                pid = int(produit.id)  # type: ignore[arg-type]
                is_favorite = 1 if pid in favorite_ids else 0
                return (is_favorite, ordered_freq.get(pid, 0))

            chosen = sorted(produits, key=personal_score, reverse=True)[:limit]

        if len(chosen) < limit:
            already = excluded | {int(p.id) for p in chosen}  # type: ignore[arg-type]
            complement = self.get_suggestions(
                session,
                list(already),
                panier_total,
                limit=limit - len(chosen),
            )
            chosen.extend(complement)

        return chosen[:limit]

    def decrement_stock(self, session: Session, product_id: int, quantity: float) -> bool:
        product = session.query(Product).filter(Product.id == product_id).first()
        if product and float(product.stock) >= quantity:
            product.stock = float(product.stock) - quantity
            session.flush()  # le commit est gere par le service appelant (__exit__)
            return True
        return False

    def sync_catalogue(self, session: Session, products_data: List[dict]) -> None:
        active_count = (
            session.query(Product)
            .filter(Product.is_active == True)  # noqa: E712
            .count()
        )
        if active_count > 0:
            print(f"[CatalogueSync] {active_count} produits existants - sync ignoree")
            return

        print("[CatalogueSync] BDD vide - seed initial en cours...")
        for product_data in products_data:
            existing = (
                session.query(Product)
                .filter(Product.nom_darija == product_data["nom_darija"])
                .first()
            )
            if existing is None:
                session.add(Product(**product_data))

        session.flush()
        self.invalidate_alias_cache()
        print("[CatalogueSync] Seed initial termine")
