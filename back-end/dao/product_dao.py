import re
import unicodedata
from typing import List, Optional

from sqlalchemy.orm import Session

from entities.product_entity import Product
from interfaces.product_dao_interface import IProductDao


class ProductDaoBD(IProductDao):

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

    def get_by_alias(self, session: Session, alias: str) -> Optional[Product]:
        normalized_alias = self._normalize_alias(alias)
        singular_alias = self._singularize(normalized_alias)

        for product in session.query(Product).filter(Product.is_active == True).all():  # noqa: E712
            aliases = self._build_aliases(product)
            if (
                normalized_alias in aliases
                or singular_alias in aliases
                or any(
                    normalized_alias in candidate or candidate in normalized_alias
                    for candidate in aliases
                )
            ):
                return product
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
        print("[CatalogueSync] Seed initial termine")
