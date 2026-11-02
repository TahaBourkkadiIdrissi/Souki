from abc import ABC, abstractmethod


class IPanierSoukiService(ABC):
    @abstractmethod
    def list_public(self): pass
    @abstractmethod
    def list_admin(self): pass
    @abstractmethod
    def create(self, payload): pass
    @abstractmethod
    def update(self, panier_id, payload): pass
