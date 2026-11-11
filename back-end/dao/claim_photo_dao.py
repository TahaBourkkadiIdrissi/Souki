from typing import Optional

from sqlalchemy.orm import Session

from entities.claim_entity import Claim
from interfaces.claim_photo_dao_interface import IClaimPhotoDao


class ClaimPhotoDaoBD(IClaimPhotoDao):
    """Lecture seule : la photo vit dans le stockage, aucune ecriture en base."""

    def get_latest_user_claim_for_line(self, session: Session, user_id: int, commande_id: int,
                                       ligne_panier_id: int) -> Optional[Claim]:
        # Filtre sur le proprietaire (anti-IDOR) : la reclamation d'un autre client n'est jamais trouvee.
        return (
            session.query(Claim)
            .filter(Claim.user_id == user_id, Claim.commande_id == commande_id, Claim.ligne_panier_id == ligne_panier_id)
            .order_by(Claim.created_at.desc(), Claim.id.desc())
            .first()
        )

    def get_claim(self, session: Session, claim_id: int) -> Optional[Claim]:
        return session.query(Claim).filter(Claim.id == claim_id).first()
