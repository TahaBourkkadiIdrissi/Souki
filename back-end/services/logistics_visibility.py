from datetime import date, datetime
from typing import Any


SUPPLIER_VISIBLE_STATUSES = {"VERROUILLEE", "EN_ATTENTE_LIVREUR", "A_LIVRER"}
LIVREUR_VISIBLE_STATUSES = {"EN_ATTENTE_LIVREUR", "A_LIVRER", "EN_ROUTE"}


def _normalize_status(value: Any) -> str:
    return str(value or "").strip().upper()


def _as_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def is_supplier_order_visible(commande: Any, fournisseur_id: int, today: date) -> bool:
    return (
        getattr(commande, "fournisseur_id", None) == fournisseur_id
        and _as_date(getattr(commande, "date_commande", None)) == today
        and _normalize_status(getattr(commande, "statut", None)) in SUPPLIER_VISIBLE_STATUSES
    )


def is_livreur_tournee_row_visible(row: dict[str, Any], today: date) -> bool:
    return (
        _as_date(row.get("date_tournee")) == today
        and row.get("fournisseur_id") is not None
        and _normalize_status(row.get("statut")) in LIVREUR_VISIBLE_STATUSES
    )
