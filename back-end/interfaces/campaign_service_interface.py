from abc import ABC, abstractmethod


class ICampaignService(ABC):
    @abstractmethod
    def list(self, *, deleted=False): pass
    @abstractmethod
    def options(self): pass
    @abstractmethod
    def set_deleted(self, campaign_id, expected_version, deleted): pass
    @abstractmethod
    def create(self, payload): pass
    @abstractmethod
    def update(self, campaign_id, payload): pass
    @abstractmethod
    def stats(self, campaign_id, start, end): pass
    @abstractmethod
    def resolve(self, slug, visitor_cookie, user_agent, *, count=True, method="GET", purpose="", sec_purpose="", x_purpose="", x_moz=""): pass
    @abstractmethod
    def qr(self, campaign_id): pass
    @abstractmethod
    def attribute_order(self, visit_cookie, order_id): pass
