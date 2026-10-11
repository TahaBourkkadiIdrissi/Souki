from abc import ABC, abstractmethod


class ICampaignDao(ABC):
    @abstractmethod
    def list(self, session): pass
    @abstractmethod
    def get(self, session, campaign_id, *, lock=False): pass
    @abstractmethod
    def by_slug(self, session, slug): pass
    @abstractmethod
    def create(self, session, values): pass
    @abstractmethod
    def update(self, session, campaign, values): pass
    @abstractmethod
    def visit(self, session, campaign_id, visitor_hash, now): pass
    @abstractmethod
    def stats(self, session, campaign_id, start=None, end=None): pass
    @abstractmethod
    def attribute_order(self, session, visit_id, order_id, since): pass
