from typing import Any, Optional, Sequence

from sqlalchemy.orm import Session

from entities.address_entity import Address
from entities.commande_entity import Commande
from services.zone_resolver import resoudre_zone


def resoudre_fournisseur_pour_commande(
    session: Session,
    commande: Commande,
    zones: Sequence[Any],
) -> Optional[int]:
    if not commande.client_id or not zones:
        return None

    adresse = (
        session.query(Address)
        .filter(
            Address.user_id == commande.client_id,
            Address.is_default.is_(True),
            Address.latitude.isnot(None),
            Address.longitude.isnot(None),
        )
        .first()
    )
    if not adresse:
        return None

    zone = resoudre_zone(
        float(adresse.latitude),
        float(adresse.longitude),
        list(zones),
    )
    fournisseur_id = getattr(zone, "fournisseur_id", None) if zone else None
    return int(fournisseur_id) if fournisseur_id is not None else None
