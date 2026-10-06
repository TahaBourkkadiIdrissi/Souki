"""Household targets, rounded in sale units and allocated by food priority."""
import json
import logging
import math
import unicodedata
from pathlib import Path

REFERENCE = json.loads((Path(__file__).parents[1] / "data/paniers-equilibres-maroc.json").read_text(encoding="utf-8"))
logger = logging.getLogger(__name__)


def normalize(value):
    return " ".join("".join(c for c in unicodedata.normalize("NFKD", str(value)).lower() if not unicodedata.combining(c)).split())


def targets(products, people, days):
    result = []
    seen = set()
    for product in products:
        price = float(product.prix_affiche if product.prix_affiche is not None else product.prix_kg)
        stock = float(product.stock or 0)
        if stock <= 0 or price <= 0 or not math.isfinite(price):
            continue
        names = {normalize(product.nom_fr), normalize(product.nom_darija)}
        key = next((key for key, aliases in REFERENCE["alias"].items() if names.intersection(map(normalize, aliases))), None)
        norm = REFERENCE["normes"].get(key, {"min": .02, "max": .04, "priority": 3, "role": "secondaire"})
        step = .5 if str(product.unite).lower() == "kg" else 1
        unit_weight = .25 if "250" in str(product.unite) else 1
        def amount(rate):
            raw = 1 if norm["role"] == "aromate" else rate * people * days / unit_weight
            return max(step, math.floor(raw / step + .5) * step)
        cap = math.floor(min(stock, amount(norm["max"]) * 1.3) / step) * step
        if cap < step:
            continue
        result.append(dict(produit_id=int(product.id), min=min(cap, amount(norm["min"])),
                           target=min(cap, amount((norm["min"] + norm["max"]) / 2)),
                           max=cap, step=step, price=price, priority=norm["priority"], role=norm["role"]))
        seen.add(key)
    for key, norm in REFERENCE["normes"].items():
        if norm["priority"] == 1 and key not in seen:
            logger.warning("Essentiel absent du catalogue disponible: %s", key)
    return sorted(result, key=lambda row: (row["priority"], row["produit_id"]))


def compose(products, payload, proposed=None):
    rows = targets(products, payload.personnes, payload.duree)
    essentials = [row for row in rows if row["priority"] == 1]
    budget = float(payload.budget)
    # Shorten coverage before reducing essential floors. Never claim a full period.
    days = payload.duree
    while days > 0 and sum(row["min"] * row["price"] for row in essentials) > budget:
        days -= 1
        rows = targets(products, payload.personnes, max(days, 1))
        essentials = [row for row in rows if row["priority"] == 1]
    quantities = {}
    remaining = budget
    for row in essentials:
        quantity = row["min"]
        if quantity * row["price"] <= remaining + 1e-8:
            quantities[row["produit_id"]] = quantity
            remaining -= quantity * row["price"]
    preferences = {}
    for item in (proposed or {}).get("composition", []):
        try:
            value = float(item.get("quantite", 0))
            if math.isfinite(value) and value > 0:
                preferences[int(item["produit_id"])] = value
        except (ValueError, TypeError, KeyError, AttributeError):
            pass
    # Essential targets first; lower priorities cannot displace their floors.
    for row in sorted(rows, key=lambda row: (row["priority"], row["produit_id"] not in preferences, row["produit_id"])):
        pid = row["produit_id"]
        desired = max(row["min"], min(row["max"], preferences.get(pid, row["target"])))
        desired = math.floor(desired / row["step"]) * row["step"]
        current = quantities.get(pid, 0)
        affordable = math.floor((remaining + 1e-8) / (row["price"] * row["step"])) * row["step"]
        addition = max(0, min(desired - current, affordable))
        if addition:
            quantities[pid] = current + addition
            remaining -= addition * row["price"]
    warning = None
    if days < payload.duree:
        warning = f"Votre budget couvre environ {days} jours d'essentiels pour {payload.personnes} personnes."
    return {"composition": [{"produit_id": pid, "quantite": qty} for pid, qty in quantities.items()], "_warning": warning}


def prompt_context(products, payload):
    examples = sorted(REFERENCE["paniers_reference"], key=lambda item: abs(item["budget"] - payload.budget))[:2]
    return json.dumps({"cibles": targets(products, payload.personnes, payload.duree), "exemples": examples}, ensure_ascii=False)
