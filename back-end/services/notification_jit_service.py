from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from entities.notification_outbox_entity import NotificationOutbox


def notifier_fournisseur(session: Session, zone: Any, resultat: Any) -> NotificationOutbox | None:
    fournisseur_id = getattr(zone, "fournisseur_id", None)
    if fournisseur_id is None:
        return None

    payload = {
        "event": "SUPPLIER_DAILY_BATCH",
        "channel": f"supplier:{int(fournisseur_id)}",
        "fournisseur_id": int(fournisseur_id),
        "date": date.today().isoformat(),
        "zone_id": getattr(zone, "id", None),
        "nom_ville": getattr(zone, "nom_ville", None),
        "nombre_commandes": int(getattr(resultat, "nombre_commandes", 0)),
        "produits": [
            {
                "product_id": detail.product_id,
                "nom_fr": detail.nom_fr,
                "quantite_kg": detail.quantite_brute_kg,
                "unite": detail.unite,
            }
            for detail in getattr(resultat, "details_produits", [])
        ],
        "server_timestamp": datetime.now(timezone.utc).isoformat(),
    }
    notification = NotificationOutbox(
        type="WEBSOCKET",
        payload=payload,
        status="PENDING",
    )
    session.add(notification)
    session.flush()
    return notification
