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
from entities.commande_entity import Commande
from services.campaign_service import CampaignService


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv("CAMPAIGN_PUBLIC_ORIGIN", "https://souki.io")
    engine = create_engine("sqlite://")
    for model in (Campaign, CampaignVisit, Commande, CampaignOrder):
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
    service.resolve(row.slug, None, "Firefox")
    with pytest.raises(HTTPException) as exc:
        service.create(payload())
    assert exc.value.status_code == 409
    service.update(row.id, CampaignUpdateDTO(**payload(active=False).model_dump(exclude={"slug"}), expected_version=1))
    with pytest.raises(HTTPException) as exc:
        service.resolve(row.slug, None, "Firefox")
    assert exc.value.status_code == 404
    assert session.query(CampaignVisit).count() == 1


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
        for method, path in [("GET", ""), ("POST", ""), ("PUT", "/1"), ("GET", "/1/stats"), ("GET", "/1/qr"), ("GET", "/1/qr-preview")]:
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
