import logging
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from entities.anomalie_entity import AnomalieLogistique
from entities.commande_entity import Commande
from entities.delivery_event_entity import DeliveryEvent
from entities.livreur_entity import Livreur
from entities.tournee_entity import Tournee


logger = logging.getLogger(__name__)


TRANSITIONS: dict[str, list[str]] = {
    "BROUILLON": ["EN_ATTENTE"],
    "EN_ATTENTE": ["CONFIRMEE", "ANNULEE"],
    "CONFIRMEE": ["VERROUILLEE", "ANNULEE"],
    "VERROUILLEE": ["EN_ATTENTE_LIVREUR", "A_LIVRER"],
    "EN_ATTENTE_LIVREUR": ["A_LIVRER", "EN_ROUTE", "REFUS_LIVREUR"],
    "REFUS_LIVREUR": ["EN_ATTENTE_LIVREUR", "ANNULEE"],
    "A_LIVRER": ["EN_ROUTE", "RETOUR_DEPOT", "REFUS_LIVREUR"],
    "EN_ROUTE": ["LIVRE", "ABSENT", "REFUS", "RETOUR_DEPOT"],
    "RETOUR_DEPOT": ["EN_ATTENTE", "ANNULEE"],
    "LIVRE": [],
    "ABSENT": [],
    "REFUS": [],
    "ANNULEE": [],
}


class CommandeTransitionError(Exception):
    pass


def changer_statut(
    session: Session,
    commande: Commande,
    nouveau_statut: str,
    actor_id: int,
    reason: str = "",
    *,
    client_event_id: Optional[uuid.UUID] = None,
    device_timestamp: Optional[datetime] = None,
    server_timestamp: Optional[datetime] = None,
) -> None:
    statut_actuel = _normalize_status(commande.statut)
    statut_cible = _normalize_status(nouveau_statut)

    # Autorise le déverrouillage JIT spécial VERROUILLEE -> CONFIRMEE
    if not (
        statut_actuel == "VERROUILLEE"
        and statut_cible == "CONFIRMEE"
        and reason == "JIT_UNLOCK"
    ) and statut_cible not in TRANSITIONS.get(statut_actuel, []):
        raise CommandeTransitionError(f"Transition interdite: {statut_actuel} -> {statut_cible}.")

    timestamp = server_timestamp or datetime.now(timezone.utc)
    event = _build_delivery_event(
        session=session,
        commande=commande,
        actor_id=actor_id,
        previous_status=statut_actuel,
        new_status=statut_cible,
        client_event_id=client_event_id,
        device_timestamp=device_timestamp or timestamp,
        server_timestamp=timestamp,
        reason=reason,
    )
    if event is not None:
        session.add(event)

    commande.statut = statut_cible
    commande.status_version = int(commande.status_version or 1) + 1

    if statut_cible == "EN_ROUTE":
        commande.enroute_at = timestamp
    elif statut_cible == "LIVRE":
        commande.delivered_at = timestamp
    elif statut_cible == "ABSENT":
        commande.absent_at = timestamp
    elif statut_cible == "RETOUR_DEPOT":
        commande.retour_depot_at = timestamp

    session.flush()


def process_end_of_day_returns(session: Session, target_date: date) -> int:
    rows = (
        session.query(Commande, Tournee)
        .join(Tournee, Commande.tournee_id == Tournee.id)
        .filter(
            Tournee.date_tournee < target_date,
            func.upper(func.coalesce(Commande.statut, "")).in_(["A_LIVRER", "EN_ROUTE"]),
        )
        .with_for_update(of=Commande)
        .all()
    )

    processed_count = 0
    for commande, tournee in rows:
        livreur_id = commande.livreur_id or tournee.livreur_id
        if livreur_id is None:
            logger.error(
                "Retour depot ignore: commande_id=%s tournee_id=%s sans livreur_id.",
                commande.id,
                tournee.id,
            )
            continue

        if commande.livreur_id is None:
            commande.livreur_id = int(livreur_id)

        changer_statut(
            session=session,
            commande=commande,
            nouveau_statut="RETOUR_DEPOT",
            actor_id=int(livreur_id),
            reason="NON_LIVRE_FIN_JOURNEE",
        )
        commande.tournee_id = None
        commande.ordre_passage = None
        session.add(
            AnomalieLogistique(
                commande_id=int(commande.id),
                type_anomalie="NON_LIVRE_FIN_JOURNEE",
            )
        )
        processed_count += 1

    session.flush()
    return processed_count


def _normalize_status(status: object) -> str:
    return str(status or "").strip().upper().replace(" ", "_")


def _build_delivery_event(
    *,
    session: Session,
    commande: Commande,
    actor_id: int,
    previous_status: str,
    new_status: str,
    client_event_id: Optional[uuid.UUID],
    device_timestamp: datetime,
    server_timestamp: datetime,
    reason: str,
) -> DeliveryEvent | None:
    if actor_id is None or int(actor_id) <= 0:
        logger.warning(
            "DeliveryEvent ignore pour commande_id=%s: actor_id invalide (%s), reason=%s.",
            commande.id,
            actor_id,
            reason,
        )
        return None

    if session.get(Livreur, int(actor_id)) is None:
        logger.warning(
            "DeliveryEvent ignore pour commande_id=%s: actor_id=%s n'est pas un livreur, reason=%s.",
            commande.id,
            actor_id,
            reason,
        )
        return None

    return DeliveryEvent(
        commande_id=int(commande.id),
        livreur_id=int(actor_id),
        previous_status=previous_status,
        new_status=new_status,
        client_event_id=client_event_id or uuid.uuid4(),
        device_timestamp=device_timestamp,
        server_timestamp=server_timestamp,
    )
