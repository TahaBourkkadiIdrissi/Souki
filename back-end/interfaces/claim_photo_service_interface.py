from abc import ABC, abstractmethod

from dto.claim_photo_dto import ClaimPhotoUploadResponse, ClaimPhotoUrlResponse


class IClaimPhotoService(ABC):
    @abstractmethod
    def attach_photo(self, user_id: int, commande_id: int, ligne_panier_id: int, content: bytes) -> ClaimPhotoUploadResponse:
        pass

    @abstractmethod
    def admin_photo_url(self, claim_id: int) -> ClaimPhotoUrlResponse:
        pass
