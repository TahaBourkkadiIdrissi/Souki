import hashlib
import hmac
import os
import re
import uuid
from datetime import datetime, timedelta
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from config import SECRET_KEY
from dto.campaign_dto import CampaignDTO, CampaignStatsDTO, CampaignRedirectDTO
from interfaces.campaign_service_interface import ICampaignService
from vendor.qrcodegen import QrCode


class CampaignService(ICampaignService):
    def __init__(self, dao, session):
        self.dao, self.session = dao, session
        self.origin = os.getenv("CAMPAIGN_PUBLIC_ORIGIN", "https://souki.io").rstrip("/")

    def _get(self, campaign_id, *, lock=False):
        row = self.dao.get(self.session, campaign_id, lock=lock)
        if row is None:
            raise HTTPException(404, "Campagne introuvable.")
        return row

    def _values(self, payload):
        values = payload.model_dump(exclude={"expected_version"})
        for field in ("name", "source", "medium", "campaign", "destination"):
            values[field] = values[field].strip()
            if not values[field]:
                raise HTTPException(400, "Les champs de la campagne ne peuvent pas être vides.")
        target = urlsplit(values["destination"])
        if target.scheme or target.netloc:
            origin = urlsplit(self.origin)
            if target.scheme != origin.scheme or target.netloc != origin.netloc:
                raise HTTPException(400, "La destination doit être une page du site Souki.")
        path = unquote(target.path)
        if not path.startswith("/") or path.startswith("//") or "\\" in path or any(ord(c) < 32 for c in values["destination"]):
            raise HTTPException(400, "Adresse de destination invalide.")
        if any(segment in {".", ".."} for segment in path.split("/")) or path.startswith(("/r/", "/backend", "/api/", "/admin")) or path == "/r":
            raise HTTPException(400, "Choisissez une page client, sans boucle de redirection.")
        values["destination"] = urlunsplit(("", "", target.path, target.query, target.fragment))
        return values

    def _target(self, row):
        if not row.active:
            return f"{self.origin}/catalogue"
        parts = urlsplit(row.destination)
        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        query.update(utm_source=row.source, utm_medium=row.medium, utm_campaign=row.campaign, utm_content=row.slug)
        return self.origin + urlunsplit(("", "", parts.path, urlencode(query), parts.fragment))

    def _dto(self, row):
        stats = self.dao.stats(self.session, row.id)
        return CampaignDTO(**{key: getattr(row, key) for key in ("id", "slug", "name", "destination", "source", "medium", "campaign", "active", "version", "created_at")},
                           short_url=f"{self.origin}/r/{row.slug}", target_url=self._target(row), **{k: v for k, v in stats.items() if k != "days"})

    def list(self):
        return [self._dto(row) for row in self.dao.list(self.session)]

    def create(self, payload):
        try:
            row = self.dao.create(self.session, self._values(payload))
            result = self._dto(row)
            self.session.commit()
            return result
        except IntegrityError:
            self.session.rollback()
            raise HTTPException(409, "Ce lien court existe déjà. Choisissez un autre identifiant.")
        except Exception:
            self.session.rollback()
            raise

    def update(self, campaign_id, payload):
        try:
            row = self._get(campaign_id, lock=True)
            if row.version != payload.expected_version:
                raise HTTPException(409, "Cette campagne a changé. Rechargez la liste avant de modifier.")
            self.dao.update(self.session, row, self._values(payload))
            result = self._dto(row)
            self.session.commit()
            return result
        except Exception:
            self.session.rollback()
            raise

    def stats(self, campaign_id, start, end):
        self._get(campaign_id)
        today = datetime.utcnow().date()
        start, end = start or today - timedelta(days=29), end or today
        if end < start or (end - start).days > 365:
            raise HTTPException(400, "Choisissez une période de 366 jours maximum, avec une fin après le début.")
        values = self.dao.stats(self.session, campaign_id, start, end)
        days = {str(day["day"]): day for day in values["days"]}
        values["days"] = [days.get(str(start + timedelta(days=i)), dict(day=start + timedelta(days=i), visits=0, visitors=0)) for i in range((end-start).days + 1)]
        return CampaignStatsDTO(start=start, end=end, **values)

    def _sign(self, value):
        return value + "." + hmac.new(SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()

    def _verify(self, value):
        if not value or len(value) != 97 or not re.fullmatch(r"[0-9a-f]{32}\.[0-9a-f]{64}", value):
            return None
        return value[:32] if hmac.compare_digest(value, self._sign(value[:32])) else None

    def resolve(self, slug, visitor_cookie, user_agent, *, count=True):
        try:
            row = self.dao.by_slug(self.session, slug)
            if row is None:
                raise HTTPException(404, "Ce lien de campagne est indisponible.")
            result = CampaignRedirectDTO(location=self._target(row))
            if not row.active:
                return result
            if count and not re.search(r"bot|crawler|spider|preview|facebookexternalhit|whatsapp|headless", user_agent or "", re.I):
                visitor = self._verify(visitor_cookie) or uuid.uuid4().hex
                visit = self.dao.visit(self.session, row.id, hashlib.sha256(visitor.encode()).hexdigest(), datetime.utcnow())
                result.visitor_cookie, result.visit_cookie = self._sign(visitor), self._sign(visit)
                self.session.commit()
            return result
        except Exception:
            self.session.rollback()
            raise

    def qr(self, campaign_id):
        row = self._get(campaign_id)
        qr = QrCode.encode_text(f"{self.origin}/r/{row.slug}", QrCode.Ecc.MEDIUM)
        size = qr.get_size() + 8
        path = " ".join(f"M{x+4},{y+4}h1v1h-1z" for y in range(qr.get_size()) for x in range(qr.get_size()) if qr.get_module(x, y))
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="600" height="600" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="{path}" fill="black"/></svg>'

    def attribute_order(self, visit_cookie, order_id):
        # Part of the checkout transaction; its service owns commit/rollback.
        visit_id = self._verify(visit_cookie)
        if visit_id:
            self.dao.attribute_order(self.session, visit_id, order_id, datetime.utcnow() - timedelta(days=30))
