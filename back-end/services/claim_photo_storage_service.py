"""Photo de reclamation (tache B5) : nettoyage strict de l'image et stockage prive.

Une photo envoyee par un client n'est jamais stockee telle quelle :
- taille brute plafonnee (8 Mo) avant tout decodage ;
- format reel verifie par Pillow (JPEG, PNG, WEBP), jamais d'apres le type declare ;
- dimensions lues dans l'en-tete AVANT le decodage : au-dela de 40 megapixels, refus
  (protection contre les « bombes de decompression ») ;
- image decodee puis reencodee en JPEG neuf : metadonnees EXIF (dont la position GPS),
  profils et toute charge cachee dans le fichier sont perdus ;
- reduite a 1600 px de cote au plus.
Le fichier propre va dans un bucket Supabase PRIVE (`reclamations`), sous un nom calcule par le
serveur (`<commande>/<reclamation>.jpg`), sans ecrasement : aucune table n'est modifiee. L'admin
le lit par une URL signee de 5 minutes.
"""

import io
import os
import warnings
from typing import Optional
from urllib import error, parse, request

from PIL import Image, ImageOps, UnidentifiedImageError

from services.supabase_storage_service import SupabaseStorageError, SupabaseStorageService

CLAIM_PHOTO_BUCKET = os.getenv("SOUKI_CLAIM_PHOTO_BUCKET", "reclamations")
MAX_CLAIM_PHOTO_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_CLAIM_PHOTO_PIXELS = 40_000_000
CLAIM_PHOTO_MAX_SIDE = 1600
CLAIM_PHOTO_SIGNED_URL_TTL_SECONDS = 300
ALLOWED_CLAIM_PHOTO_FORMATS = {"JPEG", "PNG", "WEBP"}
ALLOWED_CLAIM_PHOTO_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

INVALID_PHOTO = "Photo invalide. Envoyez une photo JPEG, PNG ou WEBP."


class ClaimPhotoError(Exception):
    status_code = 400


class ClaimPhotoTooLargeError(ClaimPhotoError):
    status_code = 413


class ClaimPhotoExistsError(ClaimPhotoError):
    status_code = 409


class ClaimPhotoStorageUnavailableError(ClaimPhotoError):
    status_code = 502


def sanitize_claim_photo(content: bytes) -> bytes:
    """Renvoie un JPEG propre, ou leve ClaimPhotoError."""
    if not content:
        raise ClaimPhotoError("Photo vide.")
    if len(content) > MAX_CLAIM_PHOTO_UPLOAD_BYTES:
        raise ClaimPhotoTooLargeError("Photo trop lourde. Maximum 8 Mo.")

    with warnings.catch_warnings():
        # Pillow previent (avertissement) puis refuse (erreur) les images geantes : on refuse des l'avertissement.
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            probe = Image.open(io.BytesIO(content))
            if probe.format not in ALLOWED_CLAIM_PHOTO_FORMATS:
                raise ClaimPhotoError(INVALID_PHOTO)
            width, height = probe.size
            if width <= 0 or height <= 0 or width * height > MAX_CLAIM_PHOTO_PIXELS:
                raise ClaimPhotoError("Photo trop grande. Prenez une photo normale avec votre téléphone.")
            probe.verify()

            image = Image.open(io.BytesIO(content))
            image.load()
            image = ImageOps.exif_transpose(image)
            image = image.convert("RGB")
            image.thumbnail((CLAIM_PHOTO_MAX_SIDE, CLAIM_PHOTO_MAX_SIDE))
            output = io.BytesIO()
            # Nouveau fichier : aucune metadonnee n'est recopiee (ni EXIF, ni GPS, ni profil).
            image.save(output, format="JPEG", quality=82, optimize=True)
            return output.getvalue()
        except ClaimPhotoError:
            raise
        except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            raise ClaimPhotoError(INVALID_PHOTO) from exc
        except Exception as exc:  # fichier tronque ou forge : jamais d'erreur 500, toujours un refus
            raise ClaimPhotoError(INVALID_PHOTO) from exc


class ClaimPhotoStorage:
    """Acces au bucket prive des photos de reclamation (cle service_role, cote serveur uniquement)."""

    def __init__(self, storage: SupabaseStorageService, bucket: str = CLAIM_PHOTO_BUCKET):
        self.storage, self.bucket = storage, bucket

    def upload(self, object_path: str, content: bytes) -> None:
        supabase_url = self.storage._resolve_supabase_url()
        service_role_key = self.storage._service_role_key()
        encoded = parse.quote(object_path, safe="/.")
        upload_request = request.Request(
            url=f"{supabase_url}/storage/v1/object/{self.bucket}/{encoded}",
            data=content,
            headers={
                "Authorization": f"Bearer {service_role_key}",
                "apikey": service_role_key,
                "Content-Type": "image/jpeg",
                # Jamais d'ecrasement : une photo envoyee reste la preuve d'origine.
                "x-upsert": "false",
                "cache-control": "60",
            },
            method="POST",
        )
        try:
            with request.urlopen(upload_request, timeout=60) as response:
                response.read()
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            if exc.code == 409 or "Duplicate" in detail or "already exists" in detail:
                raise ClaimPhotoExistsError("Une photo a déjà été envoyée pour ce produit.") from exc
            raise ClaimPhotoStorageUnavailableError("Envoi de la photo impossible pour le moment.") from exc
        except error.URLError as exc:
            raise ClaimPhotoStorageUnavailableError("Envoi de la photo impossible pour le moment.") from exc

    def signed_url(self, object_path: str) -> Optional[str]:
        """URL signee de 5 minutes, ou None si la photo n'existe pas."""
        try:
            return self.storage.create_signed_url(self.bucket, object_path, CLAIM_PHOTO_SIGNED_URL_TTL_SECONDS)
        except SupabaseStorageError as exc:
            if "not found" in str(exc).lower() or "404" in str(exc):
                return None
            raise ClaimPhotoStorageUnavailableError("Photo indisponible pour le moment.") from exc
