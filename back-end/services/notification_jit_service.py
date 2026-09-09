from datetime import date, datetime, timezone
from typing import Any
from operating_mode import suppliers_enabled

from sqlalchemy.orm import Session

from entities.notification_outbox_entity import NotificationOutbox
from services.notification_service import notification_service


def notifier_fournisseur(session: Session, zone: Any, resultat: Any) -> NotificationOutbox | None:
    if not suppliers_enabled():
        return None
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

    # En plus du canal temps reel du back-office, on previent le fournisseur
    # sur ses propres canaux (push / email) selon ses preferences.
    notification_service.notify(
        session,
        user_id=int(fournisseur_id),
        event_key="SUPPLIER_DAILY_BATCH",
        data={
            "nombre_commandes": payload["nombre_commandes"],
            "nom_ville": payload["nom_ville"],
            "zone_id": payload["zone_id"],
        },
        dedupe_suffix=f"{fournisseur_id}:{payload['date']}",
    )

    return notification
