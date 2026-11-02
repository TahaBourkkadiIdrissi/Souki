from abc import ABC, abstractmethod


class IPanierSoukiDao(ABC):
    @abstractmethod
    def list(self, session, *, active_only=False): pass
    @abstractmethod
    def get(self, session, panier_id, *, lock=False): pass
    @abstractmethod
    def get_products(self, session, product_ids): pass
    @abstractmethod
    def create(self, session, values, lignes): pass
    @abstractmethod
    def update(self, session, panier, values, lignes): pass
