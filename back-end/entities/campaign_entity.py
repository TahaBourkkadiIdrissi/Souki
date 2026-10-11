from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, func
from config import Base


class Campaign(Base):
    __tablename__ = "t_campaigns"
    id = Column(Integer, primary_key=True)
    slug = Column(String(48), nullable=False, unique=True)
    name = Column(String(120), nullable=False)
    destination = Column(String(1000), nullable=False)
    source = Column(String(80), nullable=False, default="flyer")
    medium = Column(String(80), nullable=False, default="qr")
    campaign = Column(String(80), nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class CampaignVisit(Base):
    __tablename__ = "t_campaign_visits"
    id = Column(String(32), primary_key=True)
    campaign_id = Column(Integer, ForeignKey("t_campaigns.id"), nullable=False)
    visitor_hash = Column(String(64), nullable=False)
    visited_at = Column(DateTime, nullable=False)
    __table_args__ = (Index("ix_campaign_visit_date", "campaign_id", "visited_at"),)


class CampaignOrder(Base):
    __tablename__ = "t_campaign_orders"
    order_id = Column(Integer, ForeignKey("t_commandes.id"), primary_key=True)
    visit_id = Column(String(32), ForeignKey("t_campaign_visits.id"), nullable=False)

