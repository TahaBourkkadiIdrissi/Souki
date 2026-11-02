from abc import ABC, abstractmethod


class ICategoryDao(ABC):
    @abstractmethod
    def list(self, session, *, active_only=False): pass
    @abstractmethod
    def get(self, session, category_id, *, lock=False): pass
    @abstractmethod
    def by_slug(self, session, slug): pass
    @abstractmethod
    def create(self, session, values): pass
    @abstractmethod
    def update(self, session, category, values): pass
    @abstractmethod
    def product_ids_by_category(self, session, *, active_products_only=False): pass
    @abstractmethod
    def existing_product_ids(self, session, product_ids): pass
    @abstractmethod
    def replace_products(self, session, category_id, product_ids): pass
