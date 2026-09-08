"""Deployment choices independent of users and database schema.

Supplier tables remain available for a future release. Enabling the historical
mode is an explicit deployment choice, never a role granted by a visitor.
"""
import os


def suppliers_enabled() -> bool:
    return os.getenv("SOUKI_ENABLE_SUPPLIERS", "0").lower() in {"1", "true", "yes"}


def preorders_enabled() -> bool:
    return os.getenv("SOUKI_PREORDERS", "1").lower() in {"1", "true", "yes"}


def depot_identity() -> dict:
    return {
        "shop_name": os.getenv("SOUKI_DEPOT_NAME", "Point Souki"),
        "address": os.getenv("SOUKI_DEPOT_ADDRESS", ""),
        "ville": os.getenv("SOUKI_DEPOT_CITY", ""),
        "phone": os.getenv("SOUKI_DEPOT_PHONE", ""),
    }
