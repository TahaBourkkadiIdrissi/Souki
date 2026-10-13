from datetime import date, datetime, timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from dao.campaign_dao import CampaignDao
from dto.campaign_dto import CampaignCreateDTO, CampaignUpdateDTO
from entities.campaign_entity import Campaign, CampaignVisit, CampaignOrder
from entities.campaign_lifecycle_entity import CampaignLink, CampaignLifecycle
from entities.commande_entity import Commande
from services.campaign_service import CampaignService


@pytest.fixture
def setup(monkeypatch):
    from services.campaign_service import _missing
    _missing.clear()
    monkeypatch.setenv("CAMPAIGN_PUBLIC_ORIGIN", "https://souki.io")
    engine = create_engine("sqlite://")
    for model in (Campaign, CampaignVisit, Commande, CampaignOrder, CampaignLink, CampaignLifecycle):
        model.__table__.create(engine)
    with Session(engine) as session:
        yield CampaignService(CampaignDao(), session), session
    engine.dispose()


def payload(**changes):
    return CampaignCreateDTO(**{ "slug": "flyer-fes", "name": "Flyer Fès", "destination": "/catalogue?focus=fruits", "campaign": "lancement-fes", **changes })


def test_create_update_keeps_printed_qr_and_existing_traffic(setup):
    service, session = setup
    first = service.create(payload())
    qr = service.qr(first.id)
    visit = service.resolve(first.slug, None, "Mobile Safari")
    query = parse_qs(urlsplit(visit.location).query)
    assert query["utm_source"] == ["flyer"] and query["focus"] == ["fruits"]
    update = CampaignUpdateDTO(**payload(destination="/faq").model_dump(exclude={"slug"}), expected_version=1)
    second = service.update(first.id, update)
    assert second.short_url == first.short_url
    assert second.visits == 1 and second.version == 2
    assert service.qr(first.id) == qr
    assert urlsplit(service.resolve(first.slug, visit.visitor_cookie, "Mobile Safari").location).path == "/faq"
    assert service.list()[0].visitors == 1 and service.list()[0].visits == 2
    with pytest.raises(HTTPException) as exc:
        service.update(first.id, update)
    assert exc.value.status_code == 409


@pytest.mark.parametrize("destination", ["https://evil.example", "//evil.example", "/\\evil.example", "/%2fexample.com", "/r/flyer-fes", "/catalogue/../r/flyer-fes", "javascript:alert(1)", "/backend/auth/me", "/admin", "/\r\nLocation:evil"])
def test_destination_validation(setup, destination):
    service, session = setup
    with pytest.raises(HTTPException):
        service.create(payload(destination=destination))
    assert session.query(Campaign).count() == 0


def test_duplicate_slug_and_disable_without_deleting_stats(setup):
    service, session = setup
    row = service.create(payload())
    first_visit = service.resolve(row.slug, None, "Firefox")
    qr = service.qr(row.id)
    with pytest.raises(HTTPException) as exc:
        service.create(payload())
    assert exc.value.status_code == 409
    disabled = service.update(row.id, CampaignUpdateDTO(**payload(active=False).model_dump(exclude={"slug"}), expected_version=1))
    assert disabled.target_url == "https://souki.io/catalogue"
    result = service.resolve(row.slug, first_visit.visitor_cookie, "Firefox")
    assert result.location == disabled.target_url
    assert result.visitor_cookie is None and result.visit_cookie is None
    assert session.query(CampaignVisit).count() == 1
    session.add(Commande(id=1, statut="LIVRE"))
    session.commit()
    service.attribute_order(first_visit.visit_cookie, 1)
    session.commit()
    assert service.list()[0].delivered_orders == 1
    service.update(row.id, CampaignUpdateDTO(**payload().model_dump(exclude={"slug"}), expected_version=2))
    assert service.qr(row.id) == qr
    assert "utm_campaign=" in service.resolve(row.slug, first_visit.visitor_cookie, "Firefox").location
    assert service.list()[0].visits == 2 and service.list()[0].visitors == 1


def test_disabled_redirect_and_unknown_link_remain_distinct(setup):
    from controllers.campaign_controller import resolve_campaign
    from starlette.requests import Request
    service, session = setup
    row = service.create(payload(active=False))
    request = Request({"type": "http", "method": "GET", "headers": [(b"user-agent", b"Safari")]})
    response = resolve_campaign(row.slug, request, service)
    assert response.status_code == 302 and response.headers["location"] == "https://souki.io/catalogue"
    assert "no-store" in response.headers["cache-control"]
    assert not response.headers.getlist("set-cookie")
    assert session.query(CampaignVisit).count() == 0
    with pytest.raises(HTTPException) as exc:
        resolve_campaign("inconnu", request, service)
    assert exc.value.status_code == 404


def test_bots_head_no_count_and_invalid_cookie_does_not_merge_visitors(setup):
    service, session = setup
    row = service.create(payload())
    for agent, count in [("Googlebot", True), ("WhatsApp", True), ("Firefox", False)]:
        result = service.resolve(row.slug, None, agent, count=count)
        assert result.visitor_cookie is None
    assert session.query(CampaignVisit).count() == 0
    first = service.resolve(row.slug, None, "Firefox")
    service.resolve(row.slug, first.visitor_cookie[:-1] + ("a" if first.visitor_cookie[-1] != "a" else "b"), "Firefox")
    assert service.list()[0].visitors == 2


def test_date_filter_and_order_attribution_with_signed_unexpired_visit(setup):
    service, session = setup
    row = service.create(payload())
    first = service.resolve(row.slug, None, "Safari")
    session.add_all([Commande(id=1, statut="LIVRE"), Commande(id=2, statut="ANNULEE"), Commande(id=3, statut="EN_ATTENTE")])
    session.commit()
    service.attribute_order(first.visit_cookie, 1)
    service.attribute_order(first.visit_cookie, 2)
    service.attribute_order("invalid", 3)
    session.commit()
    today = datetime.utcnow().date()
    stats = service.stats(row.id, today, today)
    assert stats.visits == 1 and stats.visitors == 1 and stats.orders == 2 and stats.delivered_orders == 1
    assert len(stats.days) == 1
    assert service.stats(row.id, today + timedelta(days=1), today + timedelta(days=1)).visits == 0
    visit = session.query(CampaignVisit).one()
    visit.visited_at = datetime.utcnow() - timedelta(days=31)
    session.commit()
    service.attribute_order(first.visit_cookie, 3)
    session.commit()
    assert session.query(CampaignOrder).count() == 2
    with pytest.raises(HTTPException):
        service.stats(row.id, today, today - timedelta(days=1))


def test_write_failure_rolls_back_campaign_and_visit(setup):
    service, session = setup
    with patch.object(session, "commit", side_effect=RuntimeError("database failed")), pytest.raises(RuntimeError):
        service.create(payload())
    assert session.query(Campaign).count() == 0
    row = service.create(payload())
    with patch.object(session, "commit", side_effect=RuntimeError("database failed")), pytest.raises(RuntimeError):
        service.resolve(row.slug, None, "Firefox")
    assert session.query(CampaignVisit).count() == 0


def test_admin_routes_require_authentication():
    from controllers.campaign_controller import campaign_router
    app = FastAPI()
    app.include_router(campaign_router)
    with TestClient(app) as client:
        for method, path in [("GET", ""), ("POST", ""), ("PUT", "/1"), ("GET", "/1/stats"), ("GET", "/1/qr"), ("GET", "/1/qr-preview"), ("GET", "/options"), ("DELETE", "/1"), ("POST", "/1/restore")]:
            assert client.request(method, "/api/admin/campaigns" + path, json=payload().model_dump()).status_code == 401


def test_public_redirect_sets_no_store_and_secure_signed_cookies(setup, monkeypatch):
    from controllers.campaign_controller import campaign_router, get_campaign_service
    service, _ = setup
    service.create(payload())
    app = FastAPI()
    app.include_router(campaign_router)
    app.dependency_overrides[get_campaign_service] = lambda: service
    # Invoke the adapter directly: the SQLite session fixture belongs to this thread.
    from controllers.campaign_controller import resolve_campaign
    from starlette.requests import Request
    response = resolve_campaign("flyer-fes", Request({"type": "http", "method": "GET", "headers": [(b"user-agent", b"Safari")]}), service)
    assert response.status_code == 302 and "no-store" in response.headers["cache-control"]
    assert "httponly" in response.headers.getlist("set-cookie")[0].lower()
    assert len(response.headers.getlist("set-cookie")) == 2


def update_payload(row, **changes):
    values = payload().model_dump(exclude={"slug"})
    return CampaignUpdateDTO(**dict(values, expected_version=row.version, **changes))


def test_rename_keeps_aliases_and_freezes_on_first_visit(setup):
    service, session = setup
    first = service.create(payload(slug="Fes"))
    assert first.short_url == "https://souki.io/fes" and first.can_rename
    renamed = service.update(first.id, update_payload(first, slug="fes-email"))
    assert renamed.short_url == "https://souki.io/fes-email"
    assert session.get(Campaign, first.id).slug == "fes"
    old = service.resolve("FES", None, "Mozilla/5.0 Safari")
    assert "utm_content=fes-email" in old.location
    service.resolve("FES-EMAIL", old.visitor_cookie, "Mozilla/5.0 Safari")
    assert service.list()[0].visits == 2 and not service.list()[0].can_rename
    with pytest.raises(HTTPException) as exc:
        service.update(first.id, update_payload(renamed, slug="autre-nom"))
    assert exc.value.status_code == 409
    with pytest.raises(HTTPException) as exc:
        service.create(payload(slug="fes-email"))
    assert exc.value.status_code == 409
    assert session.query(Campaign).count() == 1


def test_trash_restore_preserves_history_and_reservations(setup):
    service, session = setup
    first = service.create(payload())
    visit = service.resolve(first.slug, None, "Safari")
    deleted = service.set_deleted(first.id, first.version, True)
    assert deleted.deleted_at and not deleted.active and not deleted.can_rename
    assert service.list() == [] and service.list(deleted=True)[0].visits == 1
    assert service.resolve(first.slug, None, "Safari").location == "https://souki.io/catalogue"
    assert session.query(CampaignVisit).count() == 1
    with pytest.raises(HTTPException):
        service.create(payload())
    with pytest.raises(HTTPException):
        service.update(first.id, update_payload(deleted))
    with pytest.raises(HTTPException):
        service.set_deleted(first.id, first.version, False)
    session.add(Commande(id=1, statut="LIVRE")); session.commit()
    service.attribute_order(visit.visit_cookie, 1); session.commit()
    restored = service.set_deleted(first.id, deleted.version, False)
    assert restored.deleted_at is None and not restored.active
    assert restored.visits == 1 and restored.delivered_orders == 1
    assert service.list(deleted=True) == []


@pytest.mark.parametrize("slug", ["catalogue", "ADMIN", "api", "www", "produit", "brand", "login", "fes-"])
def test_reserved_and_invalid_new_names_rejected(setup, slug):
    service, session = setup
    with pytest.raises(HTTPException):
        service.create(payload(slug=slug))
    assert session.query(Campaign).count() == 0


@pytest.mark.parametrize("destination", ["https://souki.io.evil.test/catalogue", "https://souki.io@evil.test/catalogue", "http://souki.io/catalogue", "https://www.souki.io/catalogue", "/future-campaign", "/catalogue%2f..%2ffuture", "/catalogue?x=%0d%0aLocation:evil", "/catalogue?x=%5cevil", "//souki.io/catalogue"])
def test_internal_destination_policy_and_future_loop_protection(setup, destination):
    service, _ = setup
    with pytest.raises(HTTPException):
        service.create(payload(destination=destination))


def test_same_origin_destination_and_legacy_reserved_slug(setup):
    service, session = setup
    created = service.create(payload(destination="https://souki.io/catalogue?x=1#fruit"))
    assert created.destination == "/catalogue?x=1#fruit"
    session.add(Campaign(slug="catalogue", name="Legacy", destination="/faq", source="flyer", medium="qr", campaign="legacy")); session.commit()
    legacy = service.list()[0]
    assert legacy.short_url == "https://souki.io/r/catalogue"
    assert "/faq?" in service.resolve("catalogue", None, "Safari").location


@pytest.mark.parametrize("agent,headers", [
    ("facebookexternalhit/1.1", {}), ("meta-externalagent/1.1", {}), ("meta-externalfetcher", {}),
    ("WhatsApp/2.0", {}), ("Twitterbot", {}), ("GoogleImageProxy", {}), ("curl/8.0", {}),
    ("Mozilla/5.0", {"method": "HEAD"}), ("Mozilla/5.0", {"purpose": "prefetch"}),
    ("Mozilla/5.0", {"sec_purpose": "prefetch;prerender"}), ("Mozilla/5.0", {"x_purpose": "preview"}),
    ("Mozilla/5.0", {"x_moz": "prefetch"}), ("", {}),
])
def test_automated_requests_redirect_without_cookies_or_visits(setup, agent, headers):
    service, session = setup
    row = service.create(payload())
    result = service.resolve(row.slug, None, agent, **headers)
    assert "/catalogue?" in result.location and result.visit_cookie is None
    assert session.query(CampaignVisit).count() == 0 and service.list()[0].can_rename


@pytest.mark.parametrize("agent", ["Mozilla/5.0 Instagram 400.0", "Mozilla/5.0 [FBAN/FBIOS;FBAV/1.0]", "Mozilla/5.0 Safari/605.1"])
def test_human_social_browser_visits_still_count(setup, agent):
    service, _ = setup
    row = service.create(payload())
    assert service.resolve(row.slug, None, agent).visit_cookie


def test_missing_cache_prevents_repeat_queries_and_creation_invalidates(setup):
    service, _ = setup
    with patch.object(service.dao, "by_slug", wraps=service.dao.by_slug) as lookup:
        for slug in ("missing", "MISSING"):
            with pytest.raises(HTTPException):
                service.resolve(slug, None, "Safari")
        assert lookup.call_count == 1
        with pytest.raises(HTTPException):
            service.resolve("wp-login.php", None, "Safari")
        assert lookup.call_count == 1
        service.create(payload(slug="missing"))
        assert service.resolve("missing", None, "Safari").visit_cookie
        assert lookup.call_count == 2


def test_missing_cache_expires_and_is_bounded(setup):
    import services.campaign_service as module
    service, _ = setup
    with patch.object(service.dao, "by_slug", return_value=None) as lookup:
        for number in range(514):
            with pytest.raises(HTTPException):
                service.resolve(f"absent-{number}", None, "Safari")
        assert len(module._missing) == 512
        module._missing["absent-513"] = 0
        with pytest.raises(HTTPException):
            service.resolve("absent-513", None, "Safari")
        assert lookup.call_count == 515


def test_failed_rename_and_trash_are_atomic(setup):
    service, session = setup
    first = service.create(payload())
    with patch.object(session, "commit", side_effect=RuntimeError("database failed")), pytest.raises(RuntimeError):
        service.update(first.id, update_payload(first, slug="renamed"))
    assert session.get(CampaignLink, "renamed") is None
    assert service.list()[0].slug == first.slug and service.list()[0].version == first.version
    with patch.object(session, "commit", side_effect=RuntimeError("database failed")), pytest.raises(RuntimeError):
        service.set_deleted(first.id, first.version, True)
    assert service.list()[0].deleted_at is None and service.list()[0].active
