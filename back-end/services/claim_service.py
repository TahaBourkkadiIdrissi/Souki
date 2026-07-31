from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy.orm import Session

from config import LocalSession
from dto.claim_dto import (
    ClaimItemData,
    ClaimProcessedItemDTO,
    ClaimProcessResultDTO,
    ClaimRequestData,
)
from entities.commande_entity import Commande
from entities.ligne_panier_entity import LignePanier
from interfaces.claim_dao_interface import IClaimDao
from interfaces.claim_service_interface import IClaimService
from interfaces.commande_dao_interface import ICommandeVocaleDao
from interfaces.notification_outbox_service_interface import INotificationOutboxService
from interfaces.souki_wallet_service_interface import ISoukiWalletService


CLAIM_STATUS_REFUNDED = "REFUNDED"
CLAIM_TRANSACTION_TYPE = "CREDIT_SAV"
CLAIM_BACKOFFICE_CHANNEL = "bo_claims"
REFUND_WINDOW_HOURS = 24
SUSPECT_THRESHOLD = 3

ALLOWED_CLAIM_REASONS = {
    "abime",
    "poids_incorrect",
    "erreur_produit",
    "produit_manquant",
    "qualite",
    "autre",
}


class ClaimServiceError(ValueError):
    status_code = 400


class ClaimNotEligibleError(ClaimServiceError):
    status_code = 400


class ClaimNotFoundError(ClaimServiceError):
    status_code = 404


class ClaimInvalidRequestError(ClaimServiceError):
    status_code = 422


class ClaimLegacyLineError(ClaimInvalidRequestError):
    pass


class ClaimService(IClaimService):

    def __init__(
        self,
        claim_dao: IClaimDao,
        souki_wallet_service: ISoukiWalletService,
        commande_dao: ICommandeVocaleDao,
        notification_outbox_service: INotificationOutboxService,
        session: Optional[Session] = None,
    ) -> None:
        self.claim_dao = claim_dao
        self.souki_wallet_service = souki_wallet_service
        self.commande_dao = commande_dao
        self.notification_outbox_service = notification_outbox_service
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

    def process_claim(self, user_id: int, claim_request_data: ClaimRequestData) -> ClaimProcessResultDTO:
        if not claim_request_data.items:
            raise ClaimInvalidRequestError("La reclamation doit contenir au moins une ligne.")

        self._ensure_no_duplicate_lines(claim_request_data.items)

        auto_session = self.session is None
        session = self._ensure_session()
        transaction = session.begin_nested() if session.in_transaction() else session.begin()

        try:
            with transaction:
                commande = self.commande_dao.get_commande_for_claim(
                    session,
                    user_id=user_id,
                    commande_id=claim_request_data.commande_id,
                    for_update=True,
                )
                self._validate_commande_eligibility(commande)

                assert commande is not None
                line_by_id = self._build_line_index(commande)
                recent_claim_count = self.claim_dao.count_recent_claims(
                    session,
                    user_id=user_id,
                    since=datetime.now(timezone.utc) - timedelta(days=30),
                )

                wallet = self.souki_wallet_service.get_or_create_wallet(user_id, session=session)
                processed_items: list[ClaimProcessedItemDTO] = []
                notification_items: list[dict] = []
                total_refunded = Decimal("0.00")

                for item_index, item in enumerate(claim_request_data.items):
                    line = self._validate_and_get_line(session, line_by_id, item)
                    amount_refunded = self._calculate_refund_amount(line, item.quantity_claimed)
                    is_suspect = recent_claim_count + item_index >= SUSPECT_THRESHOLD

                    claim = self.claim_dao.create_claim(
                        session,
                        user_id=user_id,
                        commande_id=int(commande.id),
                        ligne_panier_id=item.ligne_panier_id,
                        reason=item.reason,
                        quantity_claimed=self._to_decimal(item.quantity_claimed),
                        amount_refunded=amount_refunded,
                        status=CLAIM_STATUS_REFUNDED,
                        is_suspect=is_suspect,
                    )

                    total_refunded += amount_refunded
                    processed_items.append(
                        ClaimProcessedItemDTO(
                            claim_id=int(claim.id),
                            ligne_panier_id=item.ligne_panier_id,
                            amount_refunded=amount_refunded,
                            is_suspect=is_suspect,
                        )
                    )
                    notification_items.append(
                        {
                            "claim_id": int(claim.id),
                            "ligne_panier_id": item.ligne_panier_id,
                            "produit_id": int(line.produit_id) if line.produit_id is not None else None,
                            "produit_nom": line.produit.nom_fr if line.produit else None,
                            "reason": item.reason,
                            "quantity_claimed": str(self._to_decimal(item.quantity_claimed)),
                            "amount_refunded": str(amount_refunded),
                            "is_suspect": is_suspect,
                        }
                    )

                self.souki_wallet_service.credit_wallet(
                    session,
                    wallet=wallet,
                    amount=total_refunded,
                    transaction_type=CLAIM_TRANSACTION_TYPE,
                )

                is_request_suspect = any(item.is_suspect for item in processed_items)
                self.notification_outbox_service.queue_backoffice_alert(
                    session,
                    event="CLAIM_CREATED",
                    channel=CLAIM_BACKOFFICE_CHANNEL,
                    priority="high" if is_request_suspect else "normal",
                    payload={
                        "commande_id": int(commande.id),
                        "user_id": user_id,
                        "claim_ids": [item.claim_id for item in processed_items],
                        "items": notification_items,
                        "amount_refunded": str(total_refunded),
                        "new_wallet_balance": str(wallet.balance),
                        "recent_claim_count_before_request": recent_claim_count,
                        "is_suspect": is_request_suspect,
                    },
                )

                result = ClaimProcessResultDTO(
                    amount_refunded=total_refunded,
                    new_wallet_balance=Decimal(str(wallet.balance or "0.00")),
                    status=CLAIM_STATUS_REFUNDED,
                    is_suspect=is_request_suspect,
                    items=processed_items,
                )

            if auto_session:
                session.expunge_all()
            return result
        except Exception:
            if auto_session:
                session.rollback()
            raise
        finally:
            if auto_session:
                self._close_owned_session()

    def _validate_commande_eligibility(self, commande: Optional[Commande]) -> None:
        if commande is None:
            raise ClaimNotFoundError("Commande introuvable ou non accessible.")

        if self._normalize_status(commande.statut) != "LIVRE":
            raise ClaimNotEligibleError("Seules les commandes livrees peuvent faire l'objet d'une reclamation.")

        if commande.delivered_at is None:
            raise ClaimNotEligibleError("Date de livraison indisponible pour cette commande.")

        delivered_at = self._as_aware_datetime(commande.delivered_at)
        if datetime.now(timezone.utc) - delivered_at > timedelta(hours=REFUND_WINDOW_HOURS):
            raise ClaimNotEligibleError("La fenetre de reclamation de 24h est expiree.")

    def _build_line_index(self, commande: Commande) -> dict[int, LignePanier]:
        if not commande.panier:
            return {}
        return {
            int(line.id): line
            for line in commande.panier.lignes
            if line.id is not None
        }

    def _validate_and_get_line(
        self,
        session: Session,
        line_by_id: dict[int, LignePanier],
        item: ClaimItemData,
    ) -> LignePanier:
        if item.reason not in ALLOWED_CLAIM_REASONS:
            raise ClaimInvalidRequestError(f"Motif de reclamation invalide: {item.reason}.")

        line = line_by_id.get(item.ligne_panier_id)
        if line is None:
            raise ClaimInvalidRequestError("La ligne de panier ne correspond pas a cette commande.")

        if line.sous_total is None:
            raise ClaimLegacyLineError("Cette ligne legacy ne contient pas de sous_total et ne peut pas etre remboursee.")

        initial_quantity = self._to_decimal(line.quantite_kg)
        claimed_quantity = self._to_decimal(item.quantity_claimed)
        if initial_quantity <= Decimal("0"):
            raise ClaimInvalidRequestError("Quantite initiale invalide pour cette ligne.")
        if claimed_quantity <= Decimal("0"):
            raise ClaimInvalidRequestError("La quantite reclamee doit etre positive.")
        if claimed_quantity > initial_quantity:
            raise ClaimInvalidRequestError("La quantite reclamee depasse la quantite commandee.")

        # Anti-rejeu (VULN-011) : comparer a la quantite commandee ne suffit pas.
        # Sans ce cumul, rejouer la meme demande crediterait le wallet a chaque
        # appel pendant les 24 h de la fenetre de reclamation. Ce qui borne le
        # remboursement, c'est ce qui RESTE non reclame sur la ligne.
        already_claimed = self.claim_dao.sum_claimed_quantity(
            session, ligne_panier_id=item.ligne_panier_id
        )
        remaining_quantity = initial_quantity - already_claimed
        if remaining_quantity <= Decimal("0"):
            raise ClaimNotEligibleError(
                "Cette ligne a deja ete integralement remboursee."
            )
        if claimed_quantity > remaining_quantity:
            raise ClaimNotEligibleError(
                f"Quantite deja remboursee sur cette ligne. Reste remboursable: {remaining_quantity}."
            )

        return line

    def _calculate_refund_amount(self, line: LignePanier, quantity_claimed: Decimal) -> Decimal:
        initial_quantity = self._to_decimal(line.quantite_kg)
        line_total = self._to_decimal(line.sous_total)
        amount = (line_total / initial_quantity) * self._to_decimal(quantity_claimed)
        return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def _ensure_no_duplicate_lines(self, items: list[ClaimItemData]) -> None:
        line_ids = [item.ligne_panier_id for item in items]
        if len(line_ids) != len(set(line_ids)):
            raise ClaimInvalidRequestError("Une ligne de panier ne peut etre reclamee qu'une seule fois par demande.")

    def _to_decimal(self, value: object) -> Decimal:
        try:
            return Decimal(str(value))
        except Exception as exc:
            raise ClaimInvalidRequestError("Montant ou quantite invalide.") from exc

    def _as_aware_datetime(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def _normalize_status(self, value: object) -> str:
        return str(value or "").strip().upper()
