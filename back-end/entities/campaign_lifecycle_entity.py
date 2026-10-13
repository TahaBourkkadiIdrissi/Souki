from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from config import Base


class CampaignLink(Base):
    __tablename__ = "t_campaign_links"
    slug = Column(String(48), primary_key=True)
    campaign_id = Column(Integer, ForeignKey("t_campaigns.id"), nullable=False, index=True)


class CampaignLifecycle(Base):
    __tablename__ = "t_campaign_lifecycle"
    campaign_id = Column(Integer, ForeignKey("t_campaigns.id"), primary_key=True)
    canonical_slug = Column(String(48), nullable=False)
    deleted_at = Column(DateTime, nullable=True)
