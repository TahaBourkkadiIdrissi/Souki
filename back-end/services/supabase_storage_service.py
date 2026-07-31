import io
import json
import os
import unicodedata
import uuid
from typing import Optional
from urllib import error, parse, request

from PIL import Image, UnidentifiedImageError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from config import engine


AVATAR_BUCKET = "avatars"
PRODUCT_BUCKET = "products"
# RISK-007 : le bucket avatars est PRIVE. Une photo de profil est une donnee
# personnelle : un bucket public la rend lisible par quiconque connait l'URL, et
# l'ancien nommage `{user_id}/profile.jpg` la rendait carrement enumerable. On ne
# stocke donc plus l'URL publique en base mais le CHEMIN de l'objet, et chaque
# lecture genere une URL signee a duree limitee.
AVATAR_SIGNED_URL_TTL_SECONDS = int(os.getenv("SOUKI_AVATAR_URL_TTL_SECONDS", "3600"))
MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024
ALLOWED_AVATAR_MIME_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
MAX_PRODUCT_IMAGE_SIZE_BYTES = 2 * 1024 * 1024
ALLOWED_PRODUCT_IMAGE_MIME_TYPES = ALLOWED_AVATAR_MIME_TYPES
ALLOWED_PRODUCT_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
PRODUCT_IMAGE_UPLOAD_CONTENT_TYPE = "image/jpeg"


class SupabaseStorageError(Exception):
    """Raised when a Supabase Storage operation fails."""


class SupabaseStorageConfigError(SupabaseStorageError):
    """Raised when required Supabase Storage configuration is missing."""


class SupabaseStorageService:
    def __init__(self):
        self.bucket = AVATAR_BUCKET
        # Le bootstrap (colonne + bucket + policies) est idempotent mais couteux :
        # on ne le rejoue pas a chaque upload une fois reussi dans ce process.
        self._bootstrapped = False

    def _ensure_bootstrapped(self) -> None:
        if self._bootstrapped:
            return
        try:
            self.bootstrap_avatar_storage()
        except Exception as exc:  # noqa: BLE001 - le bootstrap est aussi tente au demarrage
            # Un echec ici (droits DDL insuffisants, etc.) ne doit pas casser l'upload :
            # la colonne/bucket sont normalement deja crees au demarrage de l'app.
            print(f"[Avatar] Bootstrap differe ignore: {exc}")
        finally:
            self._bootstrapped = True

    @staticmethod
    def _resolve_supabase_url() -> str:
        configured_url = os.getenv("SUPABASE_URL")
        if configured_url:
            return configured_url.rstrip("/")

        db_user = os.getenv("user", "")
        if db_user.startswith("postgres."):
            project_ref = db_user.split(".", 1)[1].strip()
            if project_ref:
                return f"https://{project_ref}.supabase.co"

        raise SupabaseStorageConfigError(
            "Configuration Supabase incomplete: ajoutez SUPABASE_URL ou utilisez un utilisateur Postgres Supabase."
        )

    @staticmethod
    def _service_role_key() -> str:
        service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if service_role_key:
            return service_role_key

        raise SupabaseStorageConfigError(
            "SUPABASE_SERVICE_ROLE_KEY manquant dans le fichier .env du backend."
        )

    @staticmethod
    def _normalize_storage_error(raw_detail: str) -> str:
        try:
            payload = json.loads(raw_detail)
        except json.JSONDecodeError:
            payload = None

        detail = None
        if isinstance(payload, dict):
            detail = payload.get("message") or payload.get("error") or payload.get("details")

        if not detail:
            detail = raw_detail.strip()

        if not detail:
            return "Le televersement de l'image a echoue."

        lowered = detail.lower()
        if "mime" in lowered or "type" in lowered:
            return "Choisissez une image JPG, PNG ou WEBP."
        if "size" in lowered or "too large" in lowered:
            return "L'image ne doit pas depasser 2 Mo."
        return "Le televersement de l'image a echoue. Reessayez dans un instant."

    def ensure_avatar_column(self) -> None:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    ALTER TABLE IF EXISTS public.t_users
                    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512)
                    """
                )
            )
            connection.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1
                            FROM information_schema.columns
                            WHERE table_schema = 'public'
                              AND table_name = 't_users'
                              AND column_name = 'profile_image_url'
                        ) THEN
                            EXECUTE '
                                UPDATE public.t_users
                                SET avatar_url = profile_image_url
                                WHERE avatar_url IS NULL
                                  AND profile_image_url IS NOT NULL
                            ';
                        END IF;
                    END
                    $$;
                    """
                )
            )

    def bootstrap_avatar_storage(self) -> None:
        self.ensure_avatar_column()

        try:
            self._bootstrap_storage_objects()
        except SQLAlchemyError as exc:
            print(
                "[Startup] Configuration automatique du storage Supabase ignoree: "
                f"{exc}. Executez back-end/sql/2026-07-26_avatars_private_bucket.sql "
                "dans l'editeur SQL Supabase avec un role proprietaire pour garantir "
                "que le bucket avatars reste PRIVE."
            )

    def _bootstrap_storage_objects(self) -> None:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    -- public = FALSE (RISK-007) : les avatars ne sont lisibles
                    -- que via une URL signee generee par le backend.
                    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
                    VALUES (:bucket_id, :bucket_name, FALSE, :file_size_limit, :allowed_mime_types)
                    ON CONFLICT (id) DO UPDATE
                    SET public = EXCLUDED.public,
                        file_size_limit = EXCLUDED.file_size_limit,
                        allowed_mime_types = EXCLUDED.allowed_mime_types
                    """
                ),
                {
                    "bucket_id": self.bucket,
                    "bucket_name": self.bucket,
                    "file_size_limit": MAX_AVATAR_SIZE_BYTES,
                    "allowed_mime_types": list(ALLOWED_AVATAR_MIME_TYPES.keys()),
                },
            )

            # Plus de policies RLS ici (RISK-006) : elles testaient
            # `auth.jwt() ->> 'sub'`, or SOUKI n'emet jamais de JWT Supabase Auth.
            # Elles ne matchaient donc jamais rien — du code decoratif qui donnait
            # l'illusion d'un controle d'acces. Le bucket est prive et l'acces
            # passe exclusivement par des URLs signees cote backend.

    def upload_avatar(self, user_id: int, content: bytes, content_type: str) -> str:
        """Televerse un avatar apres validation profonde (RISK-001).

        - le MIME declare ne suffit pas : la signature reelle est verifiee via Pillow ;
        - l'image est decodee puis reencodee en JPEG (supprime metadonnees EXIF et
          charge utile eventuelle) ;
        - le nom d'objet est aleatoire (pas de collision/ecrasement previsible).
        """
        extension = ALLOWED_AVATAR_MIME_TYPES.get(content_type)
        if not extension:
            raise SupabaseStorageError("Choisissez une image JPG, PNG ou WEBP.")
        if len(content) > MAX_AVATAR_SIZE_BYTES:
            raise SupabaseStorageError("L'image ne doit pas depasser 2 Mo.")

        clean_content = self._reencode_image(content, ALLOWED_PRODUCT_IMAGE_FORMATS)
        if len(clean_content) > MAX_AVATAR_SIZE_BYTES:
            raise SupabaseStorageError("L'image ne doit pas depasser 2 Mo apres optimisation.")

        self._ensure_bootstrapped()

        supabase_url = self._resolve_supabase_url()
        service_role_key = self._service_role_key()
        object_path = f"{user_id}/{uuid.uuid4().hex}.jpg"
        encoded_object_path = parse.quote(object_path, safe="/.")

        upload_request = request.Request(
            url=f"{supabase_url}/storage/v1/object/{self.bucket}/{encoded_object_path}",
            data=clean_content,
            headers={
                "Authorization": f"Bearer {service_role_key}",
                "apikey": service_role_key,
                "Content-Type": "image/jpeg",
                "x-upsert": "true",
                # Cache court (RISK-007) : une photo de profil est une donnee
                # personnelle. Un cache CDN long survit a une revocation d'acces
                # — l'objet reste servi par le bord alors que l'origine est fermee.
                "cache-control": "60",
            },
            method="POST",
        )

        try:
            with request.urlopen(upload_request, timeout=60) as response:
                response.read()
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise SupabaseStorageError(self._normalize_storage_error(detail)) from exc
        except error.URLError as exc:
            raise SupabaseStorageError("Impossible de joindre Supabase Storage pour le moment.") from exc

        # On renvoie le CHEMIN (stocke en base), pas une URL : l'URL signee est
        # generee a la lecture, avec une expiration.
        return object_path

    def normalize_avatar_path(self, stored_value: Optional[str]) -> Optional[str]:
        """Ramene une valeur `t_users.avatar_url` a un chemin d'objet.

        Tolere les deux formats pendant la migration : les anciennes lignes
        contiennent l'URL publique complete, les nouvelles le chemin seul.
        """
        value = (stored_value or "").strip()
        if not value:
            return None

        if not value.lower().startswith(("http://", "https://")):
            return value.lstrip("/")

        path = parse.unquote(parse.urlparse(value).path)
        marker = f"/{self.bucket}/"
        index = path.find(marker)
        if index == -1:
            return None
        return path[index + len(marker):].lstrip("/") or None

    def resolve_avatar_url(self, stored_value: Optional[str]) -> Optional[str]:
        """URL signee (TTL court) pour la photo de profil, ou None.

        Ne leve jamais : une photo illisible ne doit pas casser l'affichage du
        profil, l'appelant retombe simplement sur l'avatar par defaut.
        """
        object_path = self.normalize_avatar_path(stored_value)
        if not object_path:
            return None

        try:
            return self.create_signed_url(
                self.bucket, object_path, AVATAR_SIGNED_URL_TTL_SECONDS
            )
        except SupabaseStorageError as exc:
            print(f"[Avatar] URL signee indisponible pour {object_path}: {exc}")
            return None

    def create_signed_url(self, bucket: str, object_path: str, expires_in: int) -> str:
        """Demande a Supabase Storage une URL signee temporaire pour un objet prive."""
        supabase_url = self._resolve_supabase_url()
        service_role_key = self._service_role_key()
        encoded_object_path = parse.quote(object_path, safe="/.")

        sign_request = request.Request(
            url=f"{supabase_url}/storage/v1/object/sign/{bucket}/{encoded_object_path}",
            data=json.dumps({"expiresIn": int(expires_in)}).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {service_role_key}",
                "apikey": service_role_key,
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with request.urlopen(sign_request, timeout=15) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise SupabaseStorageError(f"Signature d'URL refusee: {detail}") from exc
        except (error.URLError, json.JSONDecodeError, TypeError) as exc:
            raise SupabaseStorageError("Impossible de joindre Supabase Storage.") from exc

        signed_path = (payload or {}).get("signedURL") or (payload or {}).get("signedUrl")
        if not signed_path:
            raise SupabaseStorageError("Reponse de signature inattendue.")

        return f"{supabase_url}/storage/v1{signed_path if signed_path.startswith('/') else '/' + signed_path}"

    @staticmethod
    def _reencode_image(content: bytes, allowed_formats: set[str]) -> bytes:
        """Valide la signature reelle puis reencode l'image en JPEG propre.

        Le reencodage supprime les metadonnees (EXIF/GPS) et neutralise tout
        contenu non-image embarque dans un faux JPEG/PNG/WEBP.
        """
        try:
            image = Image.open(io.BytesIO(content))
            image.verify()
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise SupabaseStorageError(
                "Fichier invalide. Image JPEG, PNG ou WEBP uniquement."
            ) from exc

        try:
            image = Image.open(io.BytesIO(content))
            if image.format not in allowed_formats:
                raise SupabaseStorageError(
                    "Format non autorise. Formats acceptes : JPEG, PNG, WEBP."
                )

            output = io.BytesIO()
            image.convert("RGB").save(output, format="JPEG", quality=85, optimize=True)
            return output.getvalue()
        except SupabaseStorageError:
            raise
        except (OSError, ValueError) as exc:
            raise SupabaseStorageError(
                "Fichier invalide. Image JPEG, PNG ou WEBP uniquement."
            ) from exc

    def upload_product_image(
        self,
        content: bytes,
        filename: str,
        content_type: str = "image/jpeg",
        product_id: int | None = None,
    ) -> str:
        if len(content) > MAX_PRODUCT_IMAGE_SIZE_BYTES:
            raise SupabaseStorageError("Image trop grande. Maximum 2 Mo.")

        normalized_content_type = (content_type or "").split(";", 1)[0].strip().lower()
        if normalized_content_type not in ALLOWED_PRODUCT_IMAGE_MIME_TYPES:
            raise SupabaseStorageError("Choisissez une image JPG, PNG ou WEBP.")

        clean_content = self._reencode_image(content, ALLOWED_PRODUCT_IMAGE_FORMATS)

        if len(clean_content) > MAX_PRODUCT_IMAGE_SIZE_BYTES:
            raise SupabaseStorageError("Image trop grande apres optimisation. Maximum 2 Mo.")

        supabase_url = self._resolve_supabase_url()
        service_role_key = self._service_role_key()
        _ = filename
        safe_filename = f"{uuid.uuid4().hex}.jpg"
        object_path = (
            f"products/{product_id}/{safe_filename}"
            if product_id is not None
            else f"products/{safe_filename}"
        )
        encoded_object_path = parse.quote(object_path, safe="/.")

        upload_request = request.Request(
            url=f"{supabase_url}/storage/v1/object/{PRODUCT_BUCKET}/{encoded_object_path}",
            data=clean_content,
            headers={
                "Authorization": f"Bearer {service_role_key}",
                "apikey": service_role_key,
                "Content-Type": PRODUCT_IMAGE_UPLOAD_CONTENT_TYPE,
                "x-upsert": "true",
                "cache-control": "3600",
            },
            method="POST",
        )

        try:
            with request.urlopen(upload_request, timeout=60) as response:
                response.read()
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise SupabaseStorageError(self._normalize_storage_error(detail)) from exc
        except error.URLError as exc:
            raise SupabaseStorageError("Impossible de joindre Supabase Storage pour le moment.") from exc

        return self.public_product_url(object_path)

    def public_product_url(self, object_path: str) -> str:
        encoded_object_path = parse.quote(object_path, safe="/.")
        return f"{self._resolve_supabase_url()}/storage/v1/object/public/{PRODUCT_BUCKET}/{encoded_object_path}"

    @staticmethod
    def _safe_product_filename(filename: str, extension: str) -> str:
        base_name = os.path.basename(filename or "product").rsplit(".", 1)[0]
        normalized_base = (
            unicodedata.normalize("NFKD", base_name)
            .encode("ascii", "ignore")
            .decode("ascii")
        )
        safe_base = "".join(
            char if char.isascii() and (char.isalnum() or char in ("-", "_")) else "-"
            for char in normalized_base
        )
        safe_base = safe_base.strip("-_") or "product"
        return f"{safe_base}.{extension}"


avatar_storage_service = SupabaseStorageService()
