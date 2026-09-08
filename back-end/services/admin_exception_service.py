import math
from datetime import date, datetime, time, timezone
from typing import Optional
from operating_mode import suppliers_enabled

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload

from dto.admin_exception_dto import (
    CommandeAdminActionDTO,
    CommandeExceptionDTO,
    CommandeExceptionsPageDTO,
)
from entities.address_entity import Address
from entities.anomalie_entity import AnomalieLogistique
from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.fournisseur_entity import Fournisseur
from entities.user_entity import User
from services.commande_state_machine import CommandeTransitionError, TRANSITIONS, changer_statut
from services.date_utils import today_morocco


FAILURE_STATUSES = {"RETOUR_DEPOT", "ABSENT", "REFUS", "REFUS_LIVREUR"}
TERMINAL_STATUSES = {"LIVRE", "ANNULEE"}
PENDING_STATUSES = {"EN_ATTENTE", "CONFIRMEE"}


class AdminExceptionService:
    def __init__(self, session: Session) -> None:
        self.session = session

    @staticmethod
    def detect_raisons(
        commande,
        *,
        today: date,
        include_annulee: bool = False,
    ) -> list[str]:
        statut = str(getattr(commande, "statut", "") or "").strip().upper()
        date_commande = getattr(commande, "date_commande", None)
        commande_date = date_commande.date() if isinstance(date_commande, datetime) else None
        raisons: list[str] = []

        if commande_date is not None and commande_date < today and statut not in TERMINAL_STATUSES:
            raisons.append("JOUR_PRECEDENT")
        if statut == "BROUILLON":
            raisons.append("BROUILLON")
        if statut in PENDING_STATUSES:
            raisons.append("PENDING_NON_VALIDE")
        if statut in FAILURE_STATUSES:
            raisons.append("ECHEC_LIVRAISON")
        if suppliers_enabled() and getattr(commande, "fournisseur_id", None) is None and statut not in TERMINAL_STATUSES:
            raisons.append("SANS_FOURNISSEUR")
        if not statut or statut not in TRANSITIONS:
            raisons.append("ABERRANT")
        if include_annulee and statut == "ANNULEE":
            raisons.append("ANNULEE")
        return raisons

    def list_exceptions(
        self,
        *,
        raison: Optional[str],
        search: Optional[str],
        date_from: Optional[date],
        date_to: Optional[date],
        page: int,
        page_size: int,
    ) -> CommandeExceptionsPageDTO:
        include_annulee = (raison or "").strip().upper() == "ANNULEE"
        query = (
            self.session.query(Commande)
            .options(
                joinedload(Commande.client).joinedload(Client.user).selectinload(User.addresses),
                joinedload(Commande.fournisseur),
            )
        )
        if date_from:
            query = query.filter(Commande.date_commande >= datetime.combine(date_from, time.min))
        if date_to:
            query = query.filter(Commande.date_commande <= datetime.combine(date_to, time.max))

        commandes = query.order_by(Commande.date_commande.asc(), Commande.id.asc()).all()
        normalized_reason = (raison or "").strip().upper()
        normalized_search = (search or "").strip().casefold()
        items: list[CommandeExceptionDTO] = []
        for commande in commandes:
            raisons = self.detect_raisons(
                commande,
                today=today_morocco(),
                include_annulee=include_annulee,
            )
            if not raisons:
                continue
            if normalized_reason and normalized_reason not in raisons:
                continue

            item = self._serialize_commande(commande, raisons)
            if normalized_search:
                haystack = " ".join(
                    str(value or "")
                    for value in (
                        item.id,
                        item.client_nom,
                        item.client_phone,
                        item.ville,
                        item.fournisseur_nom,
                    )
                ).casefold()
                if normalized_search not in haystack:
                    continue
            items.append(item)

        total = len(items)
        start = (page - 1) * page_size
        return CommandeExceptionsPageDTO(
            items=items[start:start + page_size],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=max(1, math.ceil(total / page_size)),
        )

    def rattacher_fournisseur(
        self,
        commande_id: int,
        fournisseur_id: int,
    ) -> CommandeAdminActionDTO:
        try:
            commande = self._get_commande_for_update(commande_id)
            fournisseur = (
                self.session.query(Fournisseur)
                .filter(Fournisseur.user_id == fournisseur_id)
                .first()
            )
            if fournisseur is None or fournisseur.statut != "APPROVED":
                raise HTTPException(status_code=422, detail="Fournisseur approuvé introuvable.")
            idempotent = commande.fournisseur_id == fournisseur_id
            commande.fournisseur_id = fournisseur_id
            self.session.commit()
            return CommandeAdminActionDTO(
                commande_id=commande_id,
                fournisseur_id=fournisseur_id,
                idempotent=idempotent,
            )
        except HTTPException:
            self.session.rollback()
            raise
        except Exception as exc:
            self.session.rollback()
            raise HTTPException(status_code=500, detail="Erreur lors du rattachement fournisseur.") from exc

    def replanifier(self, commande_id: int, admin_id: int) -> CommandeAdminActionDTO:
        return self._change_status(
            commande_id=commande_id,
            admin_id=admin_id,
            target_status="EN_ATTENTE",
            reason="ADMIN_REPLANIFIE",
        )

    def annuler(self, commande_id: int, admin_id: int) -> CommandeAdminActionDTO:
        return self._change_status(
            commande_id=commande_id,
            admin_id=admin_id,
            target_status="ANNULEE",
            reason="ADMIN_ANNULE",
        )

    def _change_status(
        self,
        *,
        commande_id: int,
        admin_id: int,
        target_status: str,
        reason: str,
    ) -> CommandeAdminActionDTO:
        try:
            commande = self._get_commande_for_update(commande_id)
            current_status = str(commande.statut or "").strip().upper()
            if current_status == target_status:
                self.session.commit()
                return CommandeAdminActionDTO(
                    commande_id=commande_id,
                    nouveau_statut=target_status,
                    idempotent=True,
                )

            changer_statut(
                session=self.session,
                commande=commande,
                nouveau_statut=target_status,
                actor_id=admin_id,
                reason=reason,
            )
            commande.tournee_id = None
            commande.ordre_passage = None
            commande.livreur_id = None
            self._resolve_open_anomalies(commande_id, admin_id, target_status)
            self.session.commit()
            return CommandeAdminActionDTO(
                commande_id=commande_id,
                nouveau_statut=target_status,
                idempotent=False,
            )
        except CommandeTransitionError as exc:
            self.session.rollback()
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except HTTPException:
            self.session.rollback()
            raise
        except Exception as exc:
            self.session.rollback()
            raise HTTPException(status_code=500, detail="Erreur lors du changement de statut.") from exc

    def _get_commande_for_update(self, commande_id: int) -> Commande:
        commande = (
            self.session.query(Commande)
            .filter(Commande.id == commande_id)
            .with_for_update(of=Commande)
            .first()
        )
        if commande is None:
            raise HTTPException(status_code=404, detail="Commande introuvable.")
        return commande

    def _resolve_open_anomalies(self, commande_id: int, admin_id: int, target_status: str) -> None:
        anomalies = (
            self.session.query(AnomalieLogistique)
            .filter(
                AnomalieLogistique.commande_id == commande_id,
                AnomalieLogistique.resolved_at.is_(None),
            )
            .all()
        )
        for anomalie in anomalies:
            anomalie.resolved_at = datetime.now(timezone.utc)
            anomalie.resolved_by = admin_id
            anomalie.resolution = "REPLANIFIE" if target_status == "EN_ATTENTE" else "ANNULE_PERTE"

    def _serialize_commande(
        self,
        commande: Commande,
        raisons: list[str],
    ) -> CommandeExceptionDTO:
        user = commande.client.user if commande.client and commande.client.user else None
        addresses = list(user.addresses) if user and user.addresses else []
        address = next((item for item in addresses if item.is_default), addresses[0] if addresses else None)
        client_nom = (
            str(user.email)
            if user and user.email
            else str(user.phone)
            if user and user.phone
            else f"Client #{commande.client_id}"
        )
        return CommandeExceptionDTO(
            id=int(commande.id),
            statut=str(commande.statut) if commande.statut is not None else None,
            raisons=raisons,
            date_commande=commande.date_commande,
            client_nom=client_nom,
            client_phone=str(user.phone) if user and user.phone else None,
            ville=str(address.ville) if address and address.ville else None,
            montant_total=float(commande.montant_total or 0),
            fournisseur_id=int(commande.fournisseur_id) if commande.fournisseur_id is not None else None,
            fournisseur_nom=str(commande.fournisseur.shop_name) if commande.fournisseur else None,
            tournee_id=int(commande.tournee_id) if commande.tournee_id is not None else None,
            livreur_id=int(commande.livreur_id) if commande.livreur_id is not None else None,
        )
