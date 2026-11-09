from datetime import datetime

from sqlalchemy import case, func, text
from sqlalchemy.orm import Session, selectinload

from entities.claim_entity import Claim
from entities.ligne_panier_entity import LignePanier
from interfaces.claim_admin_dao_interface import IClaimAdminDao


class ClaimAdminDaoBD(IClaimAdminDao):
    """Lecture seule (ni flush ni commit) : liste admin des reclamations."""

    def list_recent(self, session: Session, limit: int) -> list[Claim]:
        return (
            session.query(Claim)
            .options(
                selectinload(Claim.user),
                selectinload(Claim.commande),
                selectinload(Claim.ligne_panier).selectinload(LignePanier.produit),
            )
            .order_by(Claim.created_at.desc(), Claim.id.desc())
            .limit(limit)
            .all()
        )

    def stats_since(self, session: Session, since: datetime) -> tuple[int, float, int]:
        count, amount, suspects = (
            session.query(
                func.count(Claim.id),
                func.coalesce(func.sum(Claim.amount_refunded), 0),
                func.coalesce(func.sum(case((Claim.is_suspect.is_(True), 1), else_=0)), 0),
            )
            .filter(Claim.created_at >= since)
            .one()
        )
        return int(count or 0), float(amount or 0), int(suspects or 0)

    def existing_photo_names(self, session: Session, bucket: str, names: list[str]) -> set[str]:
        if not names:
            return set()
        # Les fichiers de Supabase Storage sont references dans storage.objects : une seule
        # requete au lieu d'un appel HTTP par photo. Lecture seule ; une erreur remonte au service.
        rows = session.execute(
            text("SELECT name FROM storage.objects WHERE bucket_id = :bucket AND name = ANY(:names)"),
            {"bucket": bucket, "names": names},
        ).all()
        return {row[0] for row in rows}

    def count_photos_since(self, session: Session, bucket: str, since: datetime) -> int:
        value = session.execute(
            text("SELECT count(*) FROM storage.objects WHERE bucket_id = :bucket AND created_at >= :since"),
            {"bucket": bucket, "since": since},
        ).scalar()
        return int(value or 0)
