from abc import ABC, abstractmethod


class ICampaignService(ABC):
    @abstractmethod
    def list(self): pass
    @abstractmethod
    def create(self, payload): pass
    @abstractmethod
    def update(self, campaign_id, payload): pass
    @abstractmethod
    def stats(self, campaign_id, start, end): pass
    @abstractmethod
    def resolve(self, slug, visitor_cookie, user_agent, *, count=True): pass
    @abstractmethod
    def qr(self, campaign_id): pass
    @abstractmethod
    def attribute_order(self, visit_cookie, order_id): pass
