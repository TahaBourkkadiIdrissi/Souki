import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def notifier_fournisseur(zone: Any, resultat: Any) -> None:
    """
    Notifie le fournisseur associé à une zone après l'exécution du JIT.
    Stub : log le payload JSON. Prêt pour branchement SMTP ou webhook.

    Payload attendu par le fournisseur :
    {
        "zone_id": int,
        "nom_ville": str,
        "date": "YYYY-MM-DD",
        "fournisseur_id": int | null,
        "nombre_commandes": int,
        "volume_total_kg": float,
        "montant_total": float,
        "produits": [
            {
                "nom_fr": str,
                "volume_final_kg": float,
                "prix_achat": float,
                "sous_total_achat": float
            }
        ]
    }
    """
    try:
        from datetime import date

        payload = {
            "zone_id": getattr(zone, "id", None),
            "nom_ville": getattr(zone, "nom_ville", None),
            "date": date.today().isoformat(),
            "fournisseur_id": getattr(zone, "fournisseur_id", None),
            "nombre_commandes": getattr(resultat, "nombre_commandes", 0),
            "volume_total_kg": getattr(resultat, "volume_total_kg", 0.0),
            "montant_total": getattr(resultat, "montant_total", 0.0),
            "produits": [
                {
                    "nom_fr": d.nom_fr,
                    "volume_final_kg": d.volume_total_kg,
                    "prix_achat": d.prix_achat,
                    "sous_total_achat": d.sous_total_achat,
                }
                for d in getattr(resultat, "details_produits", [])
            ],
        }

        logger.info(
            "[JIT-NOTIF] Payload fournisseur zone=%s : %s",
            payload["nom_ville"],
            json.dumps(payload, ensure_ascii=False),
        )
        # TODO: brancher SMTP ou webhook ici
        # send_email(fournisseur_email, payload)
        # post_webhook(fournisseur_webhook_url, payload)

    except Exception as exc:
        logger.error("[JIT-NOTIF] Erreur lors de la notification fournisseur: %s", exc)
