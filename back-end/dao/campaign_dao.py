import uuid
from datetime import timedelta
from sqlalchemy import case, func
from entities.campaign_entity import Campaign, CampaignVisit, CampaignOrder
from entities.campaign_lifecycle_entity import CampaignLink, CampaignLifecycle
from entities.commande_entity import Commande
from interfaces.campaign_dao_interface import ICampaignDao


class CampaignDao(ICampaignDao):
    def list(self, session, *, deleted=False):
        query = session.query(Campaign).outerjoin(CampaignLifecycle, CampaignLifecycle.campaign_id == Campaign.id)
        query = query.filter(CampaignLifecycle.deleted_at.isnot(None) if deleted else CampaignLifecycle.deleted_at.is_(None))
        return query.order_by(Campaign.created_at.desc(), Campaign.id.desc()).all()

    def get(self, session, campaign_id, *, lock=False):
        query = session.query(Campaign).filter(Campaign.id == campaign_id)
        if lock:
            query = query.with_for_update()
        return query.populate_existing().first()

    def by_slug(self, session, slug, *, lock=False):
        link = session.get(CampaignLink, slug)
        if link:
            return self.get(session, link.campaign_id, lock=lock)
        # Compatibility with existing rows; migration seeds their reservations.
        query = session.query(Campaign).filter(func.lower(Campaign.slug) == slug)
        if lock:
            query = query.with_for_update()
        return query.populate_existing().first()

    def lifecycle(self, session, row):
        return session.query(CampaignLifecycle).filter_by(campaign_id=row.id).populate_existing().first()

    def reserve_slug(self, session, row, slug):
        existing = session.get(CampaignLink, slug)
        if existing and existing.campaign_id == row.id:
            return
        session.add(CampaignLink(slug=slug, campaign_id=row.id))
        session.flush()

    def set_lifecycle(self, session, row, slug, deleted_at):
        state = self.lifecycle(session, row)
        if state is None:
            state = CampaignLifecycle(campaign_id=row.id)
            session.add(state)
        state.canonical_slug, state.deleted_at = slug, deleted_at
        session.flush()

    def has_visits(self, session, campaign_id):
        return session.query(CampaignVisit.id).filter_by(campaign_id=campaign_id).first() is not None

    def create(self, session, values):
        row = Campaign(**values)
        session.add(row)
        session.flush()
        return row

    def update(self, session, campaign, values):
        for key, value in values.items():
            setattr(campaign, key, value)
        campaign.version += 1
        session.flush()

    def visit(self, session, campaign_id, visitor_hash, now):
        row = CampaignVisit(id=uuid.uuid4().hex, campaign_id=campaign_id, visitor_hash=visitor_hash, visited_at=now)
        session.add(row)
        session.flush()
        return row.id

    def stats(self, session, campaign_id, start=None, end=None):
        filters = [CampaignVisit.campaign_id == campaign_id]
        if start is not None:
            filters.append(CampaignVisit.visited_at >= start)
        if end is not None:
            filters.append(CampaignVisit.visited_at < end + timedelta(days=1))
        visits, visitors = session.query(func.count(CampaignVisit.id), func.count(func.distinct(CampaignVisit.visitor_hash))).filter(*filters).one()
        days = session.query(func.date(CampaignVisit.visited_at), func.count(CampaignVisit.id), func.count(func.distinct(CampaignVisit.visitor_hash))).filter(*filters).group_by(func.date(CampaignVisit.visited_at)).order_by(func.date(CampaignVisit.visited_at)).all() if start else []
        orders, delivered = session.query(func.count(CampaignOrder.order_id), func.sum(case((Commande.statut == "LIVRE", 1), else_=0))).join(CampaignVisit, CampaignVisit.id == CampaignOrder.visit_id).join(Commande, Commande.id == CampaignOrder.order_id).filter(*filters).one()
        return dict(visits=visits, visitors=visitors, orders=orders, delivered_orders=delivered or 0,
                    days=[dict(day=day, visits=count, visitors=unique) for day, count, unique in days])

    def attribute_order(self, session, visit_id, order_id, since):
        visit = session.query(CampaignVisit).filter(CampaignVisit.id == visit_id, CampaignVisit.visited_at >= since).first()
        if visit is not None:
            session.add(CampaignOrder(order_id=order_id, visit_id=visit.id))
            session.flush()
