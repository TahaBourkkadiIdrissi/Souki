from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from entities.claim_entity import Claim
from interfaces.claim_dao_interface import IClaimDao


class ClaimDaoBD(IClaimDao):

    def create_claim(
        self,
        session: Session,
        *,
        user_id: int,
        commande_id: int,
        ligne_panier_id: int,
        reason: str,
        quantity_claimed: Decimal,
        amount_refunded: Decimal,
        status: str,
        is_suspect: bool,
    ) -> Claim:
        claim = Claim(
            user_id=user_id,
            commande_id=commande_id,
            ligne_panier_id=ligne_panier_id,
            reason=reason,
            quantity_claimed=quantity_claimed,
            amount_refunded=amount_refunded,
            status=status,
            is_suspect=is_suspect,
        )
        session.add(claim)
        session.flush()
        return claim

    def count_recent_claims(
        self,
        session: Session,
        *,
        user_id: int,
        since: datetime,
    ) -> int:
        statement = (
            select(func.count(Claim.id))
            .where(Claim.user_id == user_id, Claim.created_at >= since)
        )
        return int(session.execute(statement).scalar_one() or 0)

    def sum_claimed_quantity(
        self,
        session: Session,
        *,
        ligne_panier_id: int,
    ) -> Decimal:
        """Quantite cumulee deja remboursee sur une ligne (anti-rejeu de reclamation).

        La somme porte sur TOUTES les reclamations de la ligne, quel que soit
        l'utilisateur ou la demande : c'est elle qui borne ce qui reste
        remboursable. Appelee dans la transaction qui verrouille deja la commande
        (SELECT ... FOR UPDATE), donc deux demandes concurrentes ne peuvent pas
        lire la meme somme puis crediter chacune de leur cote.
        """
        statement = (
            select(func.coalesce(func.sum(Claim.quantity_claimed), 0))
            .where(Claim.ligne_panier_id == ligne_panier_id)
        )
        return Decimal(str(session.execute(statement).scalar_one() or "0"))
