import logging
import math
import re
import uuid
from collections import defaultdict
from datetime import date, datetime, time, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from config import LocalSession, SOUKI_DEPOT_LAT, SOUKI_DEPOT_LNG
from dto.livreur_dto import (
    CodValidationResponseDTO,
    DeliveryEventRequestDTO,
    DeliveryEventResponseDTO,
    DemarrerTourneeResponseDTO,
    LivraisonDecisionRequestDTO,
    PickupDTO,
    RamassageResponseDTO,
    TourneeItemDTO,
    TourneeRefusResponseDTO,
    TourneeResponseDTO,
)
from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.delivery_event_entity import DeliveryEvent
from entities.tournee_entity import Tournee
from interfaces.livreur_dao_interface import ILivreurDao
from interfaces.livreur_service_interface import ILivreurService
from interfaces.client_blacklist_service_interface import IClientBlacklistService
from interfaces.dispatch_service_interface import IDispatchService
from services.commande_state_machine import CommandeTransitionError, TRANSITIONS, changer_statut
from services.date_utils import today_morocco
from services.logistics_visibility import (
    LIVREUR_VISIBLE_STATUSES,
    is_livreur_tournee_row_visible,
)
from dao.parrainage_dao import ParrainageDaoBD
from dao.souki_wallet_dao import SoukiWalletDaoBD
from services.parrainage_service import ParrainageService
from services.souki_wallet_service import SoukiWalletService

TOURNEE_RELEASE_TIME = time(7, 0)
LEGACY_PENDING_DELIVERY_STATUS = "EN_ATTENTE"
ASSIGNMENT_PENDING_STATUS = "EN_ATTENTE_LIVREUR"
PENDING_DELIVERY_STATUS = "A_LIVRER"
ASSIGNMENT_REFUSED_STATUS = "REFUS_LIVREUR"
STARTED_DELIVERY_STATUS = "EN_ROUTE"
TOURNEE_REFUS_ELIGIBLE_STATUSES = {ASSIGNMENT_PENDING_STATUS}
DELIVERED_STATUS = "LIVRE"
ABSENT_STATUS = "ABSENT"
REFUSED_STATUS = "REFUS"
VISIBLE_TOURNEE_STATUSES = {
    *LIVREUR_VISIBLE_STATUSES,
}
logger = logging.getLogger(__name__)

# Conversion du parrainage au passage d'une commande a LIVRE : credite parrain et
# filleul une seule fois, sur la session de livraison (atomique et non bloquant).
_parrainage_conversion_service = ParrainageService(
    ParrainageDaoBD(),
    SoukiWalletService(SoukiWalletDaoBD()),
)


class LivreurService(ILivreurService):

    def __init__(
        self,
        livreur_dao: ILivreurDao,
        client_blacklist_service: IClientBlacklistService,
        session: Optional[Session] = None,
        dispatch_service: Optional[IDispatchService] = None,
    ) -> None:
        self.livreur_dao = livreur_dao
        self.client_blacklist_service = client_blacklist_service
        self.dispatch_service = dispatch_service
        self.session = session
        self._owns_session = False

    def _ensure_session(self) -> Session:
        if self.session is None:
            self.session = LocalSession()
            self._owns_session = True
        return self.session

    def _close_owned_session(self, rollback: bool = False) -> None:
        if self.session and self._owns_session:
            if rollback:
                self.session.rollback()
            self.session.close()
            self.session = None
            self._owns_session = False

    def __enter__(self):
        self._ensure_session()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._close_owned_session(rollback=exc_type is not None)

    def get_tournee(self, livreur_id: int) -> TourneeResponseDTO:
        self._ensure_tournee_available()
        session = self._ensure_session()

        rows = self.livreur_dao.get_tournee_rows(
            session=session,
            livreur_id=livreur_id,
            visible_statuses=VISIBLE_TOURNEE_STATUSES,
            target_date=today_morocco(),
        )
        rows = [
            row
            for row in rows
            if is_livreur_tournee_row_visible(row, today_morocco())
        ]
        items = [self._build_tournee_item(row) for row in rows]
        sorted_items = sorted(
            items,
            key=lambda item: (item.ordre_passage or 999_999, item.commande_id),
        )
        sort_strategy = "ORDRE_PASSAGE"
        tournee_started = any(
            self._canonical_delivery_status(item.statut) in {STARTED_DELIVERY_STATUS, DELIVERED_STATUS, ABSENT_STATUS, REFUSED_STATUS}
            for item in sorted_items
        )
        first_row = rows[0] if rows else {}
        ramasse_at = first_row.get("ramasse_at")
        pickup = None
        if first_row.get("tournee_id") is not None:
            pickup = PickupDTO(
                fournisseur_id=first_row.get("fournisseur_id"),
                shop_name=self._clean_optional_text(first_row.get("pickup_shop_name")),
                address=self._clean_optional_text(first_row.get("pickup_address")),
                ville=self._clean_optional_text(first_row.get("pickup_ville")),
                phone=self._clean_optional_text(first_row.get("pickup_phone")),
                latitude=self._as_float(first_row.get("pickup_lat")),
                longitude=self._as_float(first_row.get("pickup_lng")),
            )

        return TourneeResponseDTO(
            date_jour=today_morocco(),
            sort_strategy=sort_strategy,
            tournee_started=tournee_started,
            tournee_id=int(first_row["tournee_id"]) if first_row.get("tournee_id") is not None else None,
            pickup=pickup,
            ramassee=ramasse_at is not None,
            ramasse_at=ramasse_at,
            items=sorted_items,
        )

    def confirmer_ramassage(self, livreur_id: int, tournee_id: int) -> RamassageResponseDTO:
        session = self._ensure_session()
        try:
            tournee = (
                session.query(Tournee)
                .options(
                    joinedload(Tournee.fournisseur),
                    selectinload(Tournee.commandes),
                )
                .filter(Tournee.id == tournee_id)
                .with_for_update(of=Tournee)
                .first()
            )
            if tournee is None:
                raise HTTPException(status_code=404, detail="Tournée introuvable.")
            if int(tournee.livreur_id) != int(livreur_id):
                raise HTTPException(status_code=403, detail="Cette tournée appartient à un autre livreur.")
            if tournee.date_tournee != today_morocco():
                raise HTTPException(status_code=409, detail="Seule la tournée du jour peut être ramassée.")

            if tournee.ramasse_at is not None:
                response = RamassageResponseDTO(
                    tournee_id=int(tournee.id),
                    ramasse_at=tournee.ramasse_at,
                    commandes_ramassees=0,
                    idempotent=True,
                )
                session.commit()
                return response

            ramasse_at = datetime.now(timezone.utc)
            tournee.ramasse_at = ramasse_at
            tournee.statut = "EN_COURS"
            commandes_ramassees = 0
            for commande in tournee.commandes or []:
                if self._canonical_delivery_status(commande.statut) != ASSIGNMENT_PENDING_STATUS:
                    continue
                changer_statut(
                    session=session,
                    commande=commande,
                    nouveau_statut=PENDING_DELIVERY_STATUS,
                    actor_id=livreur_id,
                    reason="RAMASSAGE_FOURNISSEUR",
                )
                commandes_ramassees += 1

            session.commit()
            return RamassageResponseDTO(
                tournee_id=int(tournee.id),
                ramasse_at=ramasse_at,
                commandes_ramassees=commandes_ramassees,
                idempotent=False,
            )
        except HTTPException:
            session.rollback()
            raise
        except CommandeTransitionError as exc:
            session.rollback()
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except Exception as exc:
            session.rollback()
            logger.exception(
                "Erreur lors du ramassage tournee_id=%s livreur_id=%s",
                tournee_id,
                livreur_id,
            )
            raise HTTPException(status_code=500, detail="Erreur interne lors du ramassage.") from exc

    def demarrer_tournee(self, livreur_id: int) -> DemarrerTourneeResponseDTO:
        session = self._ensure_session()
        pending_count = self.livreur_dao.count_by_statuses(
            session=session,
            livreur_id=livreur_id,
            statuses=[LEGACY_PENDING_DELIVERY_STATUS, ASSIGNMENT_PENDING_STATUS, PENDING_DELIVERY_STATUS],
        )

        return DemarrerTourneeResponseDTO(
            updated_count=0,
            previous_status="/".join(sorted({LEGACY_PENDING_DELIVERY_STATUS, ASSIGNMENT_PENDING_STATUS, PENDING_DELIVERY_STATUS})),
            new_status=STARTED_DELIVERY_STATUS,
            message=(
                "Le demarrage est desormais gere commande par commande via les evenements de livraison."
                if pending_count > 0
                else "Aucune commande a demarrer pour cette tournee."
            ),
        )

    def confirm_cod_payment(
        self,
        livreur_id: int,
        commande_id: int,
    ) -> CodValidationResponseDTO:
        session = self._ensure_session()

        try:
            context = self.livreur_dao.get_commande_delivery_context(
                session=session,
                livreur_id=livreur_id,
                commande_id=commande_id,
            )
            if not context:
                raise HTTPException(status_code=404, detail="Commande introuvable pour ce livreur.")

            commande: Commande = context["commande"]
            if not self._is_cod_mode(commande.mode_paiement):
                raise HTTPException(
                    status_code=409,
                    detail="Cette commande n'est pas en paiement a la livraison.",
                )

            if context["payment_validated"] is True:
                return CodValidationResponseDTO(
                    commande_id=int(commande.id),
                    payment_validated=True,
                    mode_paiement=self._clean_optional_text(commande.mode_paiement),
                    montant_total=float(commande.montant_total or 0.0),
                    idempotent=True,
                    message="Encaissement COD deja confirme.",
                )

            was_already_validated = self.livreur_dao.mark_cod_payment_validated(
                session=session,
                commande_id=int(commande.id),
                mode_paiement=commande.mode_paiement,
                montant_total=commande.montant_total,
            )

            self.livreur_dao.create_notification_outbox(
                session=session,
                outbox_type="WEBSOCKET",
                payload={
                    "event": "COD_PAYMENT_VALIDATED",
                    "channel": "bo_deliveries",
                    "commande_id": int(commande.id),
                    "livreur_id": int(commande.livreur_id or 0),
                    "mode_paiement": self._clean_optional_text(commande.mode_paiement),
                    "montant_total": float(commande.montant_total or 0.0),
                    "payment_validated": True,
                    "server_timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )

            session.commit()

            return CodValidationResponseDTO(
                commande_id=int(commande.id),
                payment_validated=True,
                mode_paiement=self._clean_optional_text(commande.mode_paiement),
                montant_total=float(commande.montant_total or 0.0),
                idempotent=was_already_validated,
                message=(
                    "Encaissement COD deja confirme."
                    if was_already_validated
                    else "Encaissement COD confirme. Vous pouvez maintenant livrer."
                ),
            )
        except HTTPException:
            session.rollback()
            raise
        except Exception as exc:
            session.rollback()
            logger.exception(
                "Erreur backend lors de la validation COD commande_id=%s livreur_id=%s",
                commande_id,
                livreur_id,
            )
            raise HTTPException(
                status_code=500,
                detail="Erreur interne lors de la validation COD.",
            ) from exc

    def refuser_tournee(
        self,
        livreur_id: int,
        payload: LivraisonDecisionRequestDTO,
    ) -> TourneeRefusResponseDTO:
        session = self._ensure_session()
        commande_ids: list[int] = []

        try:
            existing_event = self.livreur_dao.get_delivery_event_by_client_event_id(
                session=session,
                client_event_id=payload.client_event_id,
            )
            if existing_event is not None:
                return self._build_tournee_refus_idempotent_response(
                    event=existing_event,
                    livreur_id=livreur_id,
                )

            commandes = self.livreur_dao.get_commandes_for_tournee_refus(
                session=session,
                livreur_id=livreur_id,
                statuses=TOURNEE_REFUS_ELIGIBLE_STATUSES,
            )
            if not commandes:
                return TourneeRefusResponseDTO(
                    client_event_id=payload.client_event_id,
                    commandes_refusees=0,
                    commande_ids=[],
                    dispatch_reassign_triggered=False,
                    dispatch_status="no_orders",
                    idempotent=False,
                    message="Aucune commande assignee a refuser.",
                )

            server_timestamp = datetime.now(timezone.utc)
            for index, commande in enumerate(commandes):
                previous_status = self._canonical_delivery_status(commande.statut)
                event_client_id = (
                    payload.client_event_id
                    if index == 0
                    else self._derive_tournee_refus_client_event_id(payload.client_event_id, int(commande.id))
                )

                try:
                    changer_statut(
                        session=session,
                        commande=commande,
                        nouveau_statut=ASSIGNMENT_REFUSED_STATUS,
                        actor_id=livreur_id,
                        reason="TOURNEE_REFUSED",
                        client_event_id=event_client_id,
                        device_timestamp=payload.device_timestamp,
                        server_timestamp=server_timestamp,
                    )
                except CommandeTransitionError as exc:
                    raise HTTPException(status_code=409, detail=str(exc)) from exc

                commande_ids.append(int(commande.id))
                commande.livreur_id = None
                commande.tournee_id = None
                commande.ordre_passage = None

                self._queue_assignment_notification(
                    session=session,
                    commande=commande,
                    livreur_id=livreur_id,
                    previous_status=previous_status,
                    new_status=ASSIGNMENT_REFUSED_STATUS,
                    event_name="TOURNEE_ASSIGNMENT_REFUSED",
                    client_event_id=str(event_client_id),
                    server_timestamp=server_timestamp,
                )

            session.flush()
            self._queue_tournee_refus_notification(
                session=session,
                livreur_id=livreur_id,
                commande_ids=commande_ids,
                client_event_id=str(payload.client_event_id),
                server_timestamp=server_timestamp,
            )
            session.commit()
        except HTTPException:
            session.rollback()
            raise
        except IntegrityError as exc:
            session.rollback()
            existing_event = self.livreur_dao.get_delivery_event_by_client_event_id(
                session=session,
                client_event_id=payload.client_event_id,
            )
            if existing_event is not None:
                return self._build_tournee_refus_idempotent_response(
                    event=existing_event,
                    livreur_id=livreur_id,
                )

            logger.exception("Conflit idempotence refus global tournee livreur_id=%s", livreur_id)
            raise HTTPException(
                status_code=409,
                detail="Conflit d'idempotence sur le refus de tournee.",
            ) from exc
        except Exception as exc:
            session.rollback()
            logger.exception("Erreur backend refus global tournee livreur_id=%s", livreur_id)
            raise HTTPException(
                status_code=500,
                detail="Erreur interne lors du refus de tournee.",
            ) from exc

        dispatch_status, dispatch_reassign_triggered = self._trigger_refused_tournee_dispatch(
            livreur_id=livreur_id,
            commande_ids=commande_ids,
        )

        return TourneeRefusResponseDTO(
            client_event_id=payload.client_event_id,
            commandes_refusees=len(commande_ids),
            commande_ids=commande_ids,
            dispatch_reassign_triggered=dispatch_reassign_triggered,
            dispatch_status=dispatch_status,
            idempotent=False,
            message="Tournee refusee. Les commandes ont ete retirees de votre ecran.",
        )

    def apply_delivery_event(
        self,
        livreur_id: int,
        commande_id: int,
        payload: DeliveryEventRequestDTO,
    ) -> DeliveryEventResponseDTO:
        session = self._ensure_session()

        try:
            existing_event = self.livreur_dao.get_delivery_event_by_client_event_id(
                session=session,
                client_event_id=payload.client_event_id,
            )
            if existing_event is not None:
                if int(existing_event.commande_id) != int(commande_id):
                    raise HTTPException(status_code=409, detail="client_event_id deja utilise pour une autre commande.")

                existing_context = self.livreur_dao.get_commande_delivery_context(
                    session=session,
                    livreur_id=livreur_id,
                    commande_id=commande_id,
                )
                if not existing_context:
                    raise HTTPException(status_code=404, detail="Commande introuvable pour ce livreur.")

                return self._build_delivery_event_response(
                    event=existing_event,
                    commande=existing_context["commande"],
                    idempotent=True,
                    message="Evenement deja traite.",
                )

            context = self.livreur_dao.get_commande_delivery_context(
                session=session,
                livreur_id=livreur_id,
                commande_id=commande_id,
            )
            if not context:
                raise HTTPException(status_code=404, detail="Commande introuvable pour ce livreur.")

            commande: Commande = context["commande"]
            previous_status = self._canonical_delivery_status(commande.statut)
            target_status = payload.target_status.value

            if payload.expected_version is not None and int(commande.status_version or 1) != payload.expected_version:
                raise HTTPException(
                    status_code=409,
                    detail="Conflit de version. Rechargez la commande avant de renvoyer l'action.",
                )

            if not self._is_transition_allowed(previous_status, target_status):
                raise HTTPException(
                    status_code=409,
                    detail=f"Transition interdite: {previous_status} -> {target_status}.",
                )

            if target_status == STARTED_DELIVERY_STATUS:
                tournee = commande.tournee
                if tournee is None or tournee.ramasse_at is None:
                    raise HTTPException(
                        status_code=409,
                        detail="Ramassez d'abord chez le fournisseur.",
                    )

            if target_status == DELIVERED_STATUS and self._is_cod_mode(commande.mode_paiement):
                if context["payment_validated"] is not True:
                    raise HTTPException(
                        status_code=403,
                        detail="Encaissement COD non confirme. Livraison refusee.",
                    )

            server_timestamp = datetime.now(timezone.utc)
            try:
                changer_statut(
                    session=session,
                    commande=commande,
                    nouveau_statut=target_status,
                    actor_id=livreur_id,
                    reason="LIVREUR_APP",
                    client_event_id=payload.client_event_id,
                    device_timestamp=payload.device_timestamp,
                    server_timestamp=server_timestamp,
                )
            except CommandeTransitionError as exc:
                raise HTTPException(status_code=409, detail=str(exc)) from exc

            event = self.livreur_dao.get_delivery_event_by_client_event_id(
                session=session,
                client_event_id=payload.client_event_id,
            )
            if event is None:
                raise HTTPException(status_code=500, detail="Evenement de livraison non cree.")

            self._apply_refusal_blacklist(
                session=session,
                commande=commande,
                livreur_id=livreur_id,
                target_status=target_status,
            )

            self._queue_notifications(
                session=session,
                commande=commande,
                client_phone=context["client_phone"],
                previous_status=previous_status,
                new_status=target_status,
                client_event_id=str(payload.client_event_id),
                server_timestamp=server_timestamp,
            )

            # Parrainage : credite parrain + filleul a la 1ere livraison du filleul.
            if target_status == DELIVERED_STATUS and commande.client_id is not None:
                _parrainage_conversion_service.convert_on_delivery(
                    session, filleul_id=int(commande.client_id)
                )

            session.commit()

            return self._build_delivery_event_response(
                event=event,
                commande=commande,
                idempotent=False,
                message="Statut de livraison mis a jour avec succes.",
            )
        except HTTPException:
            session.rollback()
            raise
        except IntegrityError as exc:
            session.rollback()

            existing_event = self.livreur_dao.get_delivery_event_by_client_event_id(
                session=session,
                client_event_id=payload.client_event_id,
            )
            if existing_event is not None:
                if int(existing_event.commande_id) != int(commande_id):
                    raise HTTPException(
                        status_code=409,
                        detail="client_event_id deja utilise pour une autre commande.",
                    ) from exc

                existing_context = self.livreur_dao.get_commande_delivery_context(
                    session=session,
                    livreur_id=livreur_id,
                    commande_id=commande_id,
                )
                if existing_context:
                    return self._build_delivery_event_response(
                        event=existing_event,
                        commande=existing_context["commande"],
                        idempotent=True,
                        message="Evenement deja traite.",
                    )

            integrity_message = str(getattr(exc, "orig", exc))
            lowered_message = integrity_message.casefold()

            if "client_event_id" in lowered_message or "t_delivery_events" in lowered_message:
                raise HTTPException(
                    status_code=409,
                    detail="Conflit d'idempotence sur l'evenement de livraison.",
                ) from exc

            logger.exception(
                "IntegrityError backend lors de la mise a jour de livraison commande_id=%s livreur_id=%s: %s",
                commande_id,
                livreur_id,
                integrity_message,
            )
            raise HTTPException(
                status_code=409,
                detail=f"Contrainte base de donnees refusee: {integrity_message}",
            ) from exc
        except Exception as exc:
            session.rollback()
            logger.exception(
                "Erreur backend lors de la mise a jour de livraison commande_id=%s livreur_id=%s",
                commande_id,
                livreur_id,
            )
            raise HTTPException(
                status_code=500,
                detail="Erreur interne lors de la mise a jour de livraison.",
            ) from exc

    def _build_tournee_refus_idempotent_response(
        self,
        *,
        event: DeliveryEvent,
        livreur_id: int,
    ) -> TourneeRefusResponseDTO:
        if int(event.livreur_id) != int(livreur_id):
            raise HTTPException(status_code=409, detail="client_event_id deja utilise par un autre livreur.")

        if self._canonical_delivery_status(event.new_status) != ASSIGNMENT_REFUSED_STATUS:
            raise HTTPException(status_code=409, detail="client_event_id deja utilise pour une autre action.")

        return TourneeRefusResponseDTO(
            client_event_id=event.client_event_id,
            commandes_refusees=0,
            commande_ids=[int(event.commande_id)],
            dispatch_reassign_triggered=False,
            dispatch_status="idempotent",
            idempotent=True,
            message="Refus de tournee deja traite.",
        )

    def _derive_tournee_refus_client_event_id(
        self,
        root_client_event_id: uuid.UUID,
        commande_id: int,
    ) -> uuid.UUID:
        return uuid.uuid5(root_client_event_id, f"tournee-refus:{commande_id}")

    def _trigger_refused_tournee_dispatch(
        self,
        *,
        livreur_id: int,
        commande_ids: list[int],
    ) -> tuple[Optional[str], bool]:
        if not commande_ids:
            return "no_orders", False

        if self.dispatch_service is None:
            return "dispatch_service_unavailable", False

        try:
            with self.dispatch_service:
                result = self.dispatch_service.reassign_refused_orders(
                    commande_ids=set(commande_ids),
                    excluded_livreur_id=int(livreur_id),
                    target_date=date.today(),
                )
        except Exception as exc:
            logger.warning(
                "Reassignation dispatch apres refus global non terminee livreur_id=%s commandes=%s: %s",
                livreur_id,
                commande_ids,
                exc,
            )
            return "dispatch_failed", False

        assigned_count = int(result.get("commandes_assigned") or 0)
        return str(result.get("status") or "unknown"), assigned_count > 0

    def _ensure_tournee_available(self) -> None:
        if datetime.now().time() < TOURNEE_RELEASE_TIME:
            pass

    def _build_tournee_item(self, row: dict) -> TourneeItemDTO:
        street = self._clean_optional_text(row.get("street"))
        neighborhood = self._clean_optional_text(row.get("neighborhood"))
        details = self._clean_optional_text(row.get("details"))
        full_address = self._build_full_address(street, neighborhood, details)
        client_phone = self._clean_optional_text(row.get("client_phone"))

        return TourneeItemDTO(
            commande_id=int(row["commande_id"]),
            ordre_passage=int(row["ordre_passage"]) if row.get("ordre_passage") is not None else None,
            client_phone=client_phone,
            client_label=client_phone or f"Client #{row['commande_id']}",
            street=street,
            neighborhood=neighborhood,
            details=details,
            full_address=full_address,
            colis_count=int(row.get("colis_count") or 0),
            creneau_livraison=self._clean_optional_text(row.get("creneau_livraison")),
            statut=self._canonical_delivery_status(str(row.get("statut") or "")),
            status_version=int(row.get("status_version") or 1),
            enroute_at=row.get("enroute_at"),
            delivered_at=row.get("delivered_at"),
            absent_at=row.get("absent_at"),
            montant_total=float(row.get("montant_total") or 0.0),
            mode_paiement=self._clean_optional_text(row.get("mode_paiement")),
            payment_validated=row.get("payment_validated"),
            lat=self._as_float(row.get("lat", row.get("latitude"))),
            lng=self._as_float(row.get("lng", row.get("longitude"))),
        )

    def _sort_items(self, items: list[TourneeItemDTO]) -> tuple[list[TourneeItemDTO], str]:
        if not items:
            return items, "EMPTY"

        active_items = [
            item
            for item in items
            if self._canonical_delivery_status(item.statut)
            in {ASSIGNMENT_PENDING_STATUS, PENDING_DELIVERY_STATUS, STARTED_DELIVERY_STATUS}
        ]
        completed_items = [item for item in items if item not in active_items]

        if self._can_use_greedy_gps(active_items):
            return self._sort_by_nearest_neighbor(active_items) + completed_items, "GREEDY_GPS"

        return self._sort_by_neighborhood(active_items) + completed_items, "NEIGHBORHOOD_CLUSTER"

    def _can_use_greedy_gps(self, items: list[TourneeItemDTO]) -> bool:
        return len(items) > 0 and all(item.lat is not None and item.lng is not None for item in items)

    def _sort_by_neighborhood(self, items: list[TourneeItemDTO]) -> list[TourneeItemDTO]:
        grouped_items: dict[str, list[TourneeItemDTO]] = defaultdict(list)
        for item in items:
            neighborhood_key = (item.neighborhood or "sans-quartier").strip().casefold()
            grouped_items[neighborhood_key].append(item)

        ordered_items: list[TourneeItemDTO] = []
        for neighborhood_key in sorted(grouped_items):
            chunk = grouped_items[neighborhood_key]
            chunk.sort(
                key=lambda item: (
                    self._time_slot_sort_key(item.creneau_livraison),
                    item.commande_id,
                )
            )
            ordered_items.extend(chunk)
        return ordered_items

    def _sort_by_nearest_neighbor(self, items: list[TourneeItemDTO]) -> list[TourneeItemDTO]:
        remaining_items = items.copy()
        ordered_items: list[TourneeItemDTO] = []
        current_lat = SOUKI_DEPOT_LAT
        current_lng = SOUKI_DEPOT_LNG

        while remaining_items:
            next_item = min(
                remaining_items,
                key=lambda item: (
                    self._haversine_km(
                        current_lat,
                        current_lng,
                        item.lat,
                        item.lng,
                    ),
                    self._time_slot_sort_key(item.creneau_livraison),
                    item.commande_id,
                ),
            )
            ordered_items.append(next_item)
            remaining_items.remove(next_item)
            current_lat = next_item.lat
            current_lng = next_item.lng

        return ordered_items

    def _apply_refusal_blacklist(
        self,
        *,
        session: Session,
        commande: Commande,
        livreur_id: int,
        target_status: str,
    ) -> None:
        if target_status != REFUSED_STATUS:
            return

        if commande.client_id is None:
            return

        self.client_blacklist_service.blacklist_after_refusal(
            session=session,
            client_id=int(commande.client_id),
            commande_id=int(commande.id),
            livreur_id=livreur_id,
        )

    def _queue_notifications(
        self,
        *,
        session: Session,
        commande: Commande,
        client_phone: Optional[str],
        previous_status: str,
        new_status: str,
        client_event_id: str,
        server_timestamp: datetime,
    ) -> None:
        base_payload = {
            "commande_id": int(commande.id),
            "livreur_id": int(commande.livreur_id or 0),
            "previous_status": previous_status,
            "new_status": new_status,
            "client_event_id": client_event_id,
            "server_timestamp": server_timestamp.isoformat(),
            "status_version": int(commande.status_version or 1),
        }

        if client_phone:
            self.livreur_dao.create_notification_outbox(
                session=session,
                outbox_type="SMS",
                payload={
                    **base_payload,
                    "recipient": client_phone,
                    "message": f"Votre commande #{commande.id} est maintenant {new_status}.",
                },
            )

        self.livreur_dao.create_notification_outbox(
            session=session,
            outbox_type="WEBSOCKET",
            payload={
                **base_payload,
                "event": "DELIVERY_STATUS_UPDATED",
                "channel": "bo_deliveries",
            },
        )

        if new_status == ABSENT_STATUS:
            self.livreur_dao.create_notification_outbox(
                session=session,
                outbox_type="WEBSOCKET",
                payload={
                    **base_payload,
                    "event": "ALERT_ABSENT",
                    "channel": "bo_deliveries",
                    "priority": "high",
                },
            )

    def _queue_assignment_notification(
        self,
        *,
        session: Session,
        commande: Commande,
        livreur_id: int,
        previous_status: str,
        new_status: str,
        event_name: str,
        client_event_id: str,
        server_timestamp: datetime,
    ) -> None:
        self.livreur_dao.create_notification_outbox(
            session=session,
            outbox_type="WEBSOCKET",
            payload={
                "event": event_name,
                "channel": "bo_deliveries",
                "commande_id": int(commande.id),
                "livreur_id": int(livreur_id),
                "previous_status": previous_status,
                "new_status": new_status,
                "client_event_id": client_event_id,
                "server_timestamp": server_timestamp.isoformat(),
                "status_version": int(commande.status_version or 1),
            },
        )

    def _queue_tournee_refus_notification(
        self,
        *,
        session: Session,
        livreur_id: int,
        commande_ids: list[int],
        client_event_id: str,
        server_timestamp: datetime,
    ) -> None:
        self.livreur_dao.create_notification_outbox(
            session=session,
            outbox_type="WEBSOCKET",
            payload={
                "event": "TOURNEE_REFUSED",
                "channel": "bo_deliveries",
                "livreur_id": int(livreur_id),
                "commande_ids": commande_ids,
                "client_event_id": client_event_id,
                "server_timestamp": server_timestamp.isoformat(),
            },
        )

    def _build_delivery_event_response(
        self,
        *,
        event: DeliveryEvent,
        commande: Commande,
        idempotent: bool,
        message: str,
    ) -> DeliveryEventResponseDTO:
        return DeliveryEventResponseDTO(
            event_id=event.id,
            client_event_id=event.client_event_id,
            commande_id=int(commande.id),
            previous_status=self._canonical_delivery_status(event.previous_status),
            new_status=self._canonical_delivery_status(event.new_status),
            status_version=int(commande.status_version or 1),
            enroute_at=commande.enroute_at,
            delivered_at=commande.delivered_at,
            absent_at=commande.absent_at,
            device_timestamp=event.device_timestamp,
            server_timestamp=event.server_timestamp,
            idempotent=idempotent,
            message=message,
        )

    def _is_transition_allowed(self, previous_status: str, target_status: str) -> bool:
        return target_status in TRANSITIONS.get(previous_status, [])

    def _canonical_delivery_status(self, status: str) -> str:
        normalized_status = self._normalize_status(status)
        status_aliases = {
            "EN_COURS_DE_LIVRAISON": STARTED_DELIVERY_STATUS,
            "EN_ATTENTE": PENDING_DELIVERY_STATUS,
            "EN_ATTENTE_LIVREUR": ASSIGNMENT_PENDING_STATUS,
            "LIVREE": DELIVERED_STATUS,
            "DELIVERED": DELIVERED_STATUS,
            "REFUSE": REFUSED_STATUS,
            "REFUSED": REFUSED_STATUS,
            "REFUS_LIVREUR": ASSIGNMENT_REFUSED_STATUS,
        }
        return status_aliases.get(normalized_status, normalized_status)

    def _is_cod_mode(self, mode_paiement: Optional[str]) -> bool:
        normalized_mode = (mode_paiement or "").strip().casefold()
        return normalized_mode in {"cod", "cash", "especes", "especes_livraison", "cash_on_delivery"}

    def _haversine_km(
        self,
        lat1: Optional[float],
        lng1: Optional[float],
        lat2: Optional[float],
        lng2: Optional[float],
    ) -> float:
        if None in (lat1, lng1, lat2, lng2):
            return float("inf")

        earth_radius_km = 6371.0
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)

        haversine_value = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
        )
        return 2 * earth_radius_km * math.asin(math.sqrt(haversine_value))

    def _time_slot_sort_key(self, value: Optional[str]) -> tuple[int, str]:
        if not value:
            return (99, "")
        match = re.search(r"(\d{1,2})", value)
        if not match:
            return (99, value)
        return (int(match.group(1)), value)

    def _build_full_address(
        self,
        street: Optional[str],
        neighborhood: Optional[str],
        details: Optional[str],
    ) -> str:
        address_parts = [part for part in [street, neighborhood] if part]
        full_address = ", ".join(address_parts)
        if details:
            return f"{full_address} ({details})" if full_address else details
        if full_address:
            return full_address
        return "Adresse non renseignee"

    def _normalize_status(self, status: str) -> str:
        normalized_status = status.strip().upper()
        replacements = {
            "EN ATTENTE": LEGACY_PENDING_DELIVERY_STATUS,
            "EN ATTENTE LIVREUR": ASSIGNMENT_PENDING_STATUS,
            "A LIVRER": PENDING_DELIVERY_STATUS,
            "EN ROUTE": STARTED_DELIVERY_STATUS,
            "REFUSÉ": REFUSED_STATUS,
            "REFUS LIVREUR": ASSIGNMENT_REFUSED_STATUS,
            "REFUSE": REFUSED_STATUS,
            "CONFIRMÉE": "CONFIRMEE",
            "VERROUILLÉE": "VERROUILLEE",
        }
        return replacements.get(normalized_status, normalized_status)

    def _clean_optional_text(self, value: Optional[object]) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    def _as_float(self, value: Optional[object]) -> Optional[float]:
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
