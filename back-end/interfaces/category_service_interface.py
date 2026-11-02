from abc import ABC, abstractmethod


class ICategoryService(ABC):
    @abstractmethod
    def list_admin(self): pass
    @abstractmethod
    def list_public(self): pass
    @abstractmethod
    def create(self, payload): pass
    @abstractmethod
    def update(self, category_id, payload): pass
    @abstractmethod
    def set_products(self, category_id, payload): pass
