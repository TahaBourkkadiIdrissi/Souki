import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth_dependencies import require_client
from config import LocalSession
from dao.panier_dao import PanierDaoBD
from services import assistant_service
from services.rate_limit_service import user_action_quota

router_assistant = APIRouter(prefix="/api/assistant", tags=["Assistant"])


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=500)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)

    @field_validator("message")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Le message ne doit pas être vide.")
        return value.strip()

    @field_validator("history")
    @classmethod
    def valid_history(cls, value):
        if any(item.role == "user" and len(item.content) > 500 for item in value):
            raise ValueError("500 caractères maximum par message utilisateur.")
        if any(item.role != ("user" if i % 2 == 0 else "assistant") for i, item in enumerate(value)) or len(value) % 2:
            raise ValueError("L'historique doit contenir des échanges complets.")
        return value


def catalogue_instructions():
    with LocalSession() as session:
        return assistant_service.build_instructions(PanierDaoBD().get_active_products_for_ml(session))


@router_assistant.get("/suggestions")
def suggestions(principal=Depends(require_client)):
    return assistant_service.quick_answers()


@router_assistant.post("/chat")
async def chat(payload: ChatRequest, principal=Depends(require_client)):
    user_action_quota.ensure_within_quota("souki-assistant", principal.user_id, 30, 3600)
    try:
        assistant_service.provider_config()
    except ValueError:
        raise HTTPException(status_code=503, detail=assistant_service.UNAVAILABLE)
    # SQLAlchemy is synchronous; don't block the event loop while reading catalogue.
    from starlette.concurrency import run_in_threadpool
    try:
        instructions = await run_in_threadpool(catalogue_instructions)
    except Exception:
        raise HTTPException(status_code=503, detail=assistant_service.UNAVAILABLE)

    async def events():
        try:
            async for delta in assistant_service.stream_answer(instructions, payload.history, payload.message):
                yield "data: " + json.dumps({"delta": delta}, ensure_ascii=False) + "\n\n"
            yield 'data: {"done":true}\n\n'
        except Exception:
            yield "data: " + json.dumps({"error": assistant_service.UNAVAILABLE}, ensure_ascii=False) + "\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
