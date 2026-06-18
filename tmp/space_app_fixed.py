import json
import os
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer


MODEL_REPO_ID = os.getenv("MODEL_REPO_ID", "TahaBDI/gemma-2-2b-panier-merged")
HF_TOKEN = os.getenv("HF_TOKEN")

app = FastAPI(title="Souki Panier API")

tokenizer = None
model = None


class GenerateRequest(BaseModel):
    inputs: str
    parameters: dict[str, Any] | None = None
    options: dict[str, Any] | None = None


def load_model():
    global tokenizer, model

    if tokenizer is not None and model is not None:
        return

    tokenizer = AutoTokenizer.from_pretrained(
        MODEL_REPO_ID,
        token=HF_TOKEN,
        trust_remote_code=True,
    )

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_REPO_ID,
        token=HF_TOKEN,
        torch_dtype=torch.float32,
        low_cpu_mem_usage=True,
        trust_remote_code=True,
    )

    model.eval()


def json_object_candidates(value: str) -> list[str]:
    candidates: list[str] = []
    depth = 0
    start = -1
    in_string = False
    escaped = False

    for index, char in enumerate(value):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
            continue

        if char == "{":
            if depth == 0:
                start = index
            depth += 1
        elif char == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start >= 0:
                candidates.append(value[start : index + 1])
                start = -1

    return candidates


def extract_json_object(text: str) -> str:
    fallback: str | None = None

    for candidate in reversed(json_object_candidates(text)):
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue

        if isinstance(parsed, dict):
            fallback = candidate
            if "composition" in parsed:
                return candidate

    if fallback:
        return fallback

    raise ValueError("Aucun JSON trouve dans la sortie du modele.")


def normalize_generated_text(text: str) -> str:
    try:
        json_text = extract_json_object(text)
        parsed = json.loads(json_text)

        if not isinstance(parsed, dict):
            raise ValueError("La sortie JSON doit etre un objet.")

        if "composition" not in parsed:
            raise ValueError("La sortie JSON doit contenir composition.")

        return json.dumps(parsed, ensure_ascii=False)
    except Exception:
        return json.dumps(
            {
                "composition": [],
                "error": "Sortie modele non JSON exploitable",
                "raw": text[-1000:],
            },
            ensure_ascii=False,
        )


@app.get("/")
def health():
    return {
        "status": "ok",
        "model": MODEL_REPO_ID,
        "loaded": tokenizer is not None and model is not None,
    }


@app.post("/")
def generate(payload: GenerateRequest):
    try:
        load_model()

        params = payload.parameters or {}
        max_new_tokens = int(params.get("max_new_tokens", 512))
        do_sample = bool(params.get("do_sample", False))

        inputs = tokenizer(payload.inputs, return_tensors="pt")

        with torch.inference_mode():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=do_sample,
                pad_token_id=tokenizer.eos_token_id,
            )

        generated = tokenizer.decode(output_ids[0], skip_special_tokens=True)

        if generated.startswith(payload.inputs):
            generated = generated[len(payload.inputs) :].strip()

        generated_json = normalize_generated_text(generated)

        return [
            {
                "generated_text": generated_json
            }
        ]

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
