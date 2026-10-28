from collections import defaultdict
from entities.category_entity import Category, ProductCategory
from entities.product_entity import Product
from interfaces.category_dao_interface import ICategoryDao


class CategoryDao(ICategoryDao):
    def list(self, session, *, active_only=False):
        query = session.query(Category)
        if active_only:
            query = query.filter(Category.actif.is_(True))
        return query.order_by(Category.ordre.asc(), Category.id.asc()).all()

    def get(self, session, category_id, *, lock=False):
        query = session.query(Category).filter(Category.id == category_id)
        if lock:
            query = query.with_for_update()
        return query.populate_existing().first()

    def by_slug(self, session, slug):
        return session.query(Category).filter(Category.slug == slug).first()

    def create(self, session, values):
        row = Category(**values)
        session.add(row)
        session.flush()
        return row

    def update(self, session, category, values):
        for key, value in values.items():
            setattr(category, key, value)
        session.flush()

    def product_ids_by_category(self, session, *, active_products_only=False):
        query = session.query(ProductCategory.category_id, ProductCategory.product_id)
        if active_products_only:
            query = query.join(Product, Product.id == ProductCategory.product_id).filter(Product.is_active.is_(True))
        grouped = defaultdict(list)
        for category_id, product_id in query.order_by(ProductCategory.product_id.asc()).all():
            grouped[category_id].append(product_id)
        return grouped

    def existing_product_ids(self, session, product_ids):
        if not product_ids:
            return set()
        return {row[0] for row in session.query(Product.id).filter(Product.id.in_(product_ids)).all()}

    def replace_products(self, session, category_id, product_ids):
        session.query(ProductCategory).filter(ProductCategory.category_id == category_id).delete(synchronize_session=False)
        session.add_all(ProductCategory(product_id=product_id, category_id=category_id) for product_id in product_ids)
        session.flush()
