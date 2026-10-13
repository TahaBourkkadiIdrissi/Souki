import hashlib
import hmac
import os
import re
import uuid
import time
from collections import OrderedDict
from threading import Lock
from datetime import datetime, timedelta
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from config import SECRET_KEY
from dto.campaign_dto import CampaignDTO, CampaignStatsDTO, CampaignRedirectDTO, CampaignOptionsDTO
from interfaces.campaign_service_interface import ICampaignService
from vendor.qrcodegen import QrCode
from services.campaign_policy import ROUTES, RESERVED, SLUG, count_visit

# Only absent identifiers are cached, never redirects, cookies, or campaign state.
# Bounded and short-lived to tolerate creation on a different worker.
_missing = OrderedDict()
_missing_lock = Lock()
MISSING_TTL = 10


def _forget_missing(slug):
    with _missing_lock:
        _missing.pop(slug, None)


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
        values = payload.model_dump(exclude={"expected_version", "slug"})
        for field in ("name", "source", "medium", "campaign", "destination"):
            values[field] = values[field].strip()
            if not values[field]:
                raise HTTPException(400, "Les champs de la campagne ne peuvent pas être vides.")
        try:
            target = urlsplit(values["destination"])
        except ValueError:
            raise HTTPException(400, "Adresse de destination invalide.")
        if target.scheme or target.netloc:
            origin = urlsplit(self.origin)
            if target.scheme != origin.scheme or target.netloc != origin.netloc:
                raise HTTPException(400, "La destination doit être une page du site Souki.")
        path = target.path or "/"
        decoded = unquote(values["destination"])
        if "\\" in decoded or any(ord(c) < 32 or ord(c) == 127 for c in decoded):
            raise HTTPException(400, "Adresse de destination invalide.")
        # Allow only actual public pages, including future links not yet created:
        # arbitrary root slugs could later become campaign-to-campaign loops.
        if not self._destination_path(path):
            raise HTTPException(400, "Choisissez une page client, sans boucle de redirection.")
        values["destination"] = urlunsplit(("", "", path, target.query, target.fragment))
        return values

    @staticmethod
    def _destination_path(path):
        path = path.rstrip("/") or "/"
        return path in ROUTES["destinations"] or any(
            path.startswith(prefix) and re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", path[len(prefix):])
            for prefix in ROUTES["destinationPrefixes"]
        )

    @staticmethod
    def _validate_slug(slug):
        if not SLUG.fullmatch(slug or ""):
            raise HTTPException(400, "Le lien doit contenir 3 à 48 caractères : minuscules sans accents, chiffres et tirets entre les caractères.")
        if slug in RESERVED:
            raise HTTPException(400, "Ce nom est réservé à une page du site. Choisissez un autre lien.")
        return slug

    def options(self):
        return CampaignOptionsDTO(public_origin=self.origin, reserved_slugs=sorted(RESERVED))

    def _state(self, row):
        state = self.dao.lifecycle(self.session, row)
        return (state.canonical_slug, state.deleted_at) if state else (row.slug, None)

    def _short_url(self, slug):
        # Legacy collisions keep the /r/ namespace; never shadow application routes.
        return f"{self.origin}/{'r/' if slug in RESERVED else ''}{slug}"

    def _target(self, row):
        slug, deleted_at = self._state(row)
        if not row.active or deleted_at:
            return f"{self.origin}/catalogue"
        parts = urlsplit(row.destination)
        if parts.netloc or parts.scheme or not self._destination_path(parts.path):
            return f"{self.origin}/catalogue"
        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        query.update(utm_source=row.source, utm_medium=row.medium, utm_campaign=row.campaign, utm_content=slug)
        return self.origin + urlunsplit(("", "", parts.path, urlencode(query), parts.fragment))

    def _dto(self, row):
        stats = self.dao.stats(self.session, row.id)
        slug, deleted_at = self._state(row)
        return CampaignDTO(**{key: getattr(row, key) for key in ("id", "name", "destination", "source", "medium", "campaign", "active", "version", "created_at")},
                           slug=slug, deleted_at=deleted_at, can_rename=stats["visits"] == 0 and deleted_at is None,
                           short_url=self._short_url(slug), target_url=self._target(row), **{k: v for k, v in stats.items() if k != "days"})

    def list(self, *, deleted=False):
        return [self._dto(row) for row in self.dao.list(self.session, deleted=deleted)]

    def create(self, payload):
        try:
            slug = self._validate_slug(payload.slug)
            row = self.dao.create(self.session, dict(self._values(payload), slug=slug))
            self.dao.reserve_slug(self.session, row, slug)
            self.dao.set_lifecycle(self.session, row, slug, None)
            result = self._dto(row)
            self.session.commit()
            _forget_missing(slug)
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
            current_slug, deleted_at = self._state(row)
            if deleted_at:
                raise HTTPException(409, "Restaurez cette campagne avant de la modifier.")
            slug = payload.slug if payload.slug is not None else current_slug
            if slug != current_slug:
                self._validate_slug(slug)
                if self.dao.has_visits(self.session, row.id):
                    raise HTTPException(409, "Le nom du lien est figé dès la première visite.")
                self.dao.reserve_slug(self.session, row, current_slug)
                self.dao.reserve_slug(self.session, row, slug)
                self.dao.set_lifecycle(self.session, row, slug, None)
            self.dao.update(self.session, row, self._values(payload))
            result = self._dto(row)
            self.session.commit()
            _forget_missing(slug)
            return result
        except IntegrityError:
            self.session.rollback()
            raise HTTPException(409, "Ce nom de lien est déjà réservé, même si sa campagne est dans la corbeille.")
        except Exception:
            self.session.rollback()
            raise

    def set_deleted(self, campaign_id, expected_version, deleted):
        try:
            row = self._get(campaign_id, lock=True)
            if row.version != expected_version:
                raise HTTPException(409, "Cette campagne a changé. Rechargez la liste.")
            slug, _ = self._state(row)
            self.dao.set_lifecycle(self.session, row, slug, datetime.utcnow() if deleted else None)
            # Restore paused: reactivation is an explicit administrator choice.
            self.dao.update(self.session, row, {"active": False})
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

    def resolve(self, slug, visitor_cookie, user_agent, *, count=True, method="GET", purpose="", sec_purpose="", x_purpose="", x_moz=""):
        slug = slug.lower()
        # Legacy slugs permit trailing hyphens; new names are more strictly validated.
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}", slug):
            raise HTTPException(404, "Lien introuvable.")
        with _missing_lock:
            if _missing.get(slug, 0) > time.monotonic():
                raise HTTPException(404, "Lien introuvable.")
        eligible = count and count_visit(user_agent, method, purpose, sec_purpose, x_purpose, x_moz)
        try:
            # Same row lock as rename/trash makes the first visit and rename atomic.
            row = self.dao.by_slug(self.session, slug, lock=bool(eligible))
            if row is None:
                with _missing_lock:
                    _missing[slug] = time.monotonic() + MISSING_TTL
                    _missing.move_to_end(slug)
                    while len(_missing) > 512:
                        _missing.popitem(last=False)
                raise HTTPException(404, "Ce lien de campagne est indisponible.")
            result = CampaignRedirectDTO(location=self._target(row))
            if not row.active or self._state(row)[1]:
                return result
            if eligible:
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
        qr = QrCode.encode_text(self._short_url(self._state(row)[0]), QrCode.Ecc.MEDIUM)
        size = qr.get_size() + 8
        path = " ".join(f"M{x+4},{y+4}h1v1h-1z" for y in range(qr.get_size()) for x in range(qr.get_size()) if qr.get_module(x, y))
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="600" height="600" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="{path}" fill="black"/></svg>'

    def attribute_order(self, visit_cookie, order_id):
        # Part of the checkout transaction; its service owns commit/rollback.
        visit_id = self._verify(visit_cookie)
        if visit_id:
            self.dao.attribute_order(self.session, visit_id, order_id, datetime.utcnow() - timedelta(days=30))
