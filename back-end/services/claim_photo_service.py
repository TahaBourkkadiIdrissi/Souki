"""Photo de reclamation (tache B5), optionnelle, une par ligne reclamee.

Le client l'envoie juste apres sa reclamation : la photo est rattachee a sa derniere
reclamation sur cette ligne, au plus 2 heures apres. Une seule photo par reclamation, jamais
remplacee. Lecture seule en base : ni commit ni rollback.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from dto.claim_photo_dto import ClaimPhotoUploadResponse, ClaimPhotoUrlResponse
from interfaces.claim_photo_dao_interface import IClaimPhotoDao
from interfaces.claim_photo_service_interface import IClaimPhotoService
from services.claim_photo_storage_service import (
    CLAIM_PHOTO_SIGNED_URL_TTL_SECONDS,
    ClaimPhotoError,
    ClaimPhotoStorage,
    sanitize_claim_photo,
)

CLAIM_PHOTO_WINDOW = timedelta(hours=2)


def claim_photo_path(claim) -> str:
    """Nom calcule par le serveur, jamais fourni par le client."""
    return f"{int(claim.commande_id)}/{int(claim.id)}.jpg"


class ClaimPhotoService(IClaimPhotoService):
    def __init__(self, dao: IClaimPhotoDao, storage: ClaimPhotoStorage, session: Session):
        self.dao, self.storage, self.session = dao, storage, session

    @staticmethod
    def _aware(value: datetime) -> datetime:
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    def attach_photo(self, user_id: int, commande_id: int, ligne_panier_id: int, content: bytes) -> ClaimPhotoUploadResponse:
        claim = self.dao.get_latest_user_claim_for_line(self.session, user_id, commande_id, ligne_panier_id)
        if claim is None:
            raise HTTPException(404, "Réclamation introuvable.")
        if claim.created_at is None or datetime.now(timezone.utc) - self._aware(claim.created_at) > CLAIM_PHOTO_WINDOW:
            raise HTTPException(409, "Le délai pour ajouter une photo à cette réclamation est dépassé.")
        try:
            clean = sanitize_claim_photo(content)
            self.storage.upload(claim_photo_path(claim), clean)
        except ClaimPhotoError as exc:
            raise HTTPException(exc.status_code, str(exc)) from exc
        return ClaimPhotoUploadResponse(status="success")

    def admin_photo_url(self, claim_id: int) -> ClaimPhotoUrlResponse:
        claim = self.dao.get_claim(self.session, claim_id)
        if claim is None:
            raise HTTPException(404, "Réclamation introuvable.")
        try:
            url = self.storage.signed_url(claim_photo_path(claim))
        except ClaimPhotoError as exc:
            raise HTTPException(exc.status_code, str(exc)) from exc
        if url is None:
            raise HTTPException(404, "Aucune photo pour cette réclamation.")
        return ClaimPhotoUrlResponse(url=url, expires_in=CLAIM_PHOTO_SIGNED_URL_TTL_SECONDS)
