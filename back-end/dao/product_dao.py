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

        for product in session.query(Product).all():
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
        return session.query(Product).order_by(Product.id.asc()).all()

    def get_suggestions(
        self,
        session: Session,
        exclude_ids: list[int],
        limit: int = 3,
    ) -> List[Product]:
        query = (
            session.query(Product)
            .filter(Product.niveau.in_([2, 3]))
            .filter(Product.prix_affiche.isnot(None))
            .filter(Product.stock > 0)
            .order_by(Product.niveau.desc(), Product.prix_affiche.desc())
        )
        if exclude_ids:
            query = query.filter(Product.id.notin_(exclude_ids))
        return query.limit(limit).all()

    def decrement_stock(self, session: Session, product_id: int, quantity: float) -> bool:
        product = session.query(Product).filter(Product.id == product_id).first()
        if product and float(product.stock) >= quantity:
            product.stock = float(product.stock) - quantity
            try:
                session.commit()
                return True
            except Exception as e:
                session.rollback()
                print(f"Erreur decrement stock: {e}")
                return False
        return False

    def sync_catalogue(self, session: Session, products_data: List[dict]) -> None:
        """
        Synchronize the product catalogue with the provided data.
        This method will:
        1. First clear any products with duplicate nom_darija that conflict with catalog data
        2. Then upsert products based on ID matching
        """
        # First pass: Clear conflicting duplicates
        catalog_darija_map = {p["nom_darija"].lower(): p["id"] for p in products_data}
        
        # Delete products with nom_darija that conflict with our catalog
        # but don't match the expected ID
        for product in session.query(Product).all():
            if product.nom_darija:
                darija_lower = str(product.nom_darija).lower()
                expected_id = catalog_darija_map.get(darija_lower)
                # If this nom_darija should belong to a different ID, delete this product
                if expected_id is not None and product.id != expected_id:
                    session.delete(product)
        
        session.flush()  # Flush deletions before syncing
        
        with session.no_autoflush:
            existing_products = session.query(Product).all()
            products_by_id = {product.id: product for product in existing_products}
            products_by_name = {str(product.nom_fr).lower(): product for product in existing_products}

            for product_data in products_data:
                # Try to find product by ID first
                product = products_by_id.get(product_data["id"])
                
                # If not found by ID, try by French name
                if product is None:
                    product = products_by_name.get(str(product_data["nom_fr"]).lower())

                if product is None:
                    # New product, add it
                    new_product = Product(**product_data)
                    session.add(new_product)
                else:
                    # Update existing product
                    product.nom_fr = product_data["nom_fr"]
                    product.nom_darija = product_data["nom_darija"]
                    product.prix_kg = product_data["prix_kg"]
                    product.unite = product_data["unite"]
                    if float(product.stock or 0) <= 0:
                        product.stock = product_data["stock"]

        try:
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Erreur sync catalogue: {e}")
            raise
