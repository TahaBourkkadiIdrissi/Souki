"""Ecran admin des reclamations : 100 dernieres, chiffres des 30 derniers jours, photo presente ou non.

Lecture seule. La seule ecriture possible est un rollback, si la lecture de storage.objects
echoue (la transaction est alors invalide) : la liste s'affiche quand meme, sans l'information
« photo ».
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from dto.claim_admin_dto import ClaimAdminItemDTO, ClaimAdminOverviewDTO
from interfaces.claim_admin_dao_interface import IClaimAdminDao
from interfaces.claim_admin_service_interface import IClaimAdminService
from services.claim_photo_service import claim_photo_path
from services.claim_photo_storage_service import CLAIM_PHOTO_BUCKET

logger = logging.getLogger("souki.claims.admin")

MAX_ITEMS = 200


def _client_name(user) -> str | None:
    if user is None:
        return None
    name = " ".join(part for part in (user.prenom, user.nom) if part)
    return name or None


class ClaimAdminService(IClaimAdminService):
    def __init__(self, dao: IClaimAdminDao, session: Session):
        self.dao, self.session = dao, session

    def get_overview(self, limit: int) -> ClaimAdminOverviewDTO:
        since = datetime.now(timezone.utc) - timedelta(days=30)
        total, amount, suspects = self.dao.stats_since(self.session, since)
        claims = self.dao.list_recent(self.session, max(1, min(limit, MAX_ITEMS)))

        # DTO construits AVANT la lecture du stockage : un rollback ensuite ne touche plus rien.
        items = []
        for claim in claims:
            line = claim.ligne_panier
            product = line.produit if line else None
            items.append(ClaimAdminItemDTO(
                id=int(claim.id),
                created_at=claim.created_at,
                commande_id=int(claim.commande_id),
                date_livraison=claim.commande.date_livraison if claim.commande else None,
                client_id=int(claim.user_id),
                client_nom=_client_name(claim.user),
                produit=str(product.nom_fr) if product else "Produit retiré",
                unite=str(product.unite) if product and product.unite else "kg",
                reason=str(claim.reason),
                quantity_claimed=float(claim.quantity_claimed or 0),
                amount_refunded=float(claim.amount_refunded or 0),
                status=str(claim.status or ""),
                is_suspect=bool(claim.is_suspect),
            ))

        photos_30j = None
        try:
            # Le DTO porte commande_id et id : meme nom de fichier que celui de l'envoi.
            present = self.dao.existing_photo_names(self.session, CLAIM_PHOTO_BUCKET, [claim_photo_path(item) for item in items])
            for item in items:
                item.has_photo = claim_photo_path(item) in present
            photos_30j = self.dao.count_photos_since(self.session, CLAIM_PHOTO_BUCKET, since)
        except SQLAlchemyError as exc:
            logger.warning("Photos de reclamation illisibles dans storage.objects : %s", exc)
            self.session.rollback()

        return ClaimAdminOverviewDTO(
            total_30j=total,
            montant_30j=round(amount, 2),
            suspects_30j=suspects,
            avec_photo_30j=photos_30j,
            items=items,
        )

