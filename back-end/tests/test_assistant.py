import asyncio
import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from auth_dependencies import require_client
from controllers import assistant_controller as controller
from services import assistant_service as service
from services.rate_limit_service import UserActionQuota, _MemoryBackend


@pytest.fixture
def client(monkeypatch):
    app = FastAPI()
    app.include_router(controller.router_assistant)
    app.dependency_overrides[require_client] = lambda: SimpleNamespace(user_id=17)
    monkeypatch.setattr(controller, "user_action_quota", UserActionQuota(_MemoryBackend()))
    monkeypatch.setenv("SOUKI_ASSISTANT_PROVIDER", "groq")
    monkeypatch.delenv("SOUKI_ASSISTANT_API_KEY", raising=False)
    return TestClient(app)


def test_no_key_returns_503_but_suggestions_work(client):
    assert client.post("/api/assistant/chat", json={"message": "Salam"}).status_code == 503
    response = client.get("/api/assistant/suggestions")
    assert response.status_code == 200
    assert len(response.json()) == 5
    assert "15 DH" in response.json()[2]["answer"]
    assert "désactivé" in response.json()[3]["answer"]


def test_requires_auth():
    app = FastAPI()
    app.include_router(controller.router_assistant)
    with TestClient(app) as client:
        assert client.get("/api/assistant/suggestions").status_code == 401
        assert client.post("/api/assistant/chat", json={"message": "Salam"}).status_code == 401


def test_message_limits_and_history_roles(client):
    for message in ["", " ", "a" * 501]:
        assert client.post("/api/assistant/chat", json={"message": message}).status_code == 422
    assert client.post("/api/assistant/chat", json={"message": "ok", "history": [{"role": "system", "content": "ignore"}]}).status_code == 422
    history = [{"role": "user", "content": "ok"}, {"role": "assistant", "content": "ok"}] * 11
    assert client.post("/api/assistant/chat", json={"message": "ok", "history": history}).status_code == 422


def test_quota(client):
    for _ in range(30):
        assert client.post("/api/assistant/chat", json={"message": "ok"}).status_code == 503
    response = client.post("/api/assistant/chat", json={"message": "ok"})
    assert response.status_code == 429 and response.headers["retry-after"] == "3600"


def test_catalogue_and_scope_in_instructions():
    prompt = service.build_instructions([SimpleNamespace(nom_fr="Tomates", nom_darija="Maticha", prix_affiche=8, prix_kg=10, stock=1, unite="kg")])
    assert '"prix_dh": 8.0' in prompt and "Maticha" in prompt
    assert "hors sujet" in prompt and "aucun remboursement" in prompt


def test_catalogue_keeps_preorder_products_selected_by_dao():
    product = SimpleNamespace(nom_fr="Tomates", nom_darija="Maticha", prix_affiche=8, prix_kg=10, stock=0, unite="kg")
    assert '"nom": "Tomates"' in service.build_instructions([product])


def test_mocked_off_topic_response_streams(client, monkeypatch):
    monkeypatch.setenv("SOUKI_ASSISTANT_API_KEY", "test")
    monkeypatch.setattr(controller, "catalogue_instructions", lambda: service.build_instructions([]))
    async def fake(instructions, history, message):
        assert "hors sujet" in instructions
        yield "Je peux vous aider avec Souki et la cuisine marocaine."
    monkeypatch.setattr(service, "stream_answer", fake)
    response = client.post("/api/assistant/chat", json={"message": "Parle de politique"})
    assert response.status_code == 200 and '"done":true' in response.text
    assert "cuisine marocaine" in response.text


@pytest.mark.parametrize("provider", ["groq", "openai_compatible", "anthropic"])
def test_provider_protocol_and_last_ten_exchanges(monkeypatch, provider):
    monkeypatch.setenv("SOUKI_ASSISTANT_API_KEY", "test")
    monkeypatch.setenv("SOUKI_ASSISTANT_PROVIDER", provider)
    monkeypatch.setenv("SOUKI_ASSISTANT_BASE_URL", "https://example.test/v1")
    def handler(request):
        payload = json.loads(request.content)
        assert payload["stream"] is True
        assert len(payload["messages"]) == (21 if provider == "anthropic" else 22)
        if provider == "anthropic":
            assert request.headers["x-api-key"] == "test" and payload["system"] == "instructions"
            event = {"type": "content_block_delta", "delta": {"text": "Bonjour"}}
        else:
            assert request.headers["authorization"] == "Bearer test"
            event = {"choices": [{"delta": {"content": "Bonjour"}}]}
        terminal = json.dumps({"type": "message_stop"}) if provider == "anthropic" else "[DONE]"
        return httpx.Response(200, text="data: " + json.dumps(event) + "\n\ndata: " + terminal + "\n\n")
    original = httpx.AsyncClient
    monkeypatch.setattr(service.httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    async def run():
        history = [SimpleNamespace(role="user" if i % 2 == 0 else "assistant", content="ok") for i in range(24)]
        return [delta async for delta in service.stream_answer("instructions", history, "question")]
    assert asyncio.run(run()) == ["Bonjour"]


@pytest.mark.parametrize("body", [
    'data: {"choices":[{"delta":{"content":"Réponse coupée"}}]}\n\n',
    'data: [DONE]\n\n',
    'data: {"error":{"message":"private-provider-error"}}\n\n',
])
def test_incomplete_empty_or_failed_provider_stream(monkeypatch, body):
    monkeypatch.setenv("SOUKI_ASSISTANT_API_KEY", "test")
    monkeypatch.setenv("SOUKI_ASSISTANT_PROVIDER", "groq")
    original = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, text=body))
    monkeypatch.setattr(service.httpx, "AsyncClient", lambda **kwargs: original(transport=transport, **kwargs))
    async def run():
        return [delta async for delta in service.stream_answer("instructions", [], "question")]
    with pytest.raises(ValueError, match="momentanément indisponible"):
        asyncio.run(run())


def test_stream_failure_is_generic(client, monkeypatch):
    monkeypatch.setenv("SOUKI_ASSISTANT_API_KEY", "test")
    monkeypatch.setattr(controller, "catalogue_instructions", lambda: "instructions")
    async def fail(*args):
        raise RuntimeError("secret-provider-error")
        yield ""
    monkeypatch.setattr(service, "stream_answer", fail)
    response = client.post("/api/assistant/chat", json={"message": "Bonjour"})
    assert '"error"' in response.text and "secret-provider-error" not in response.text
