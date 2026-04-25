import json
import os
from urllib import error, parse, request

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from config import engine


AVATAR_BUCKET = "avatars"
MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024
ALLOWED_AVATAR_MIME_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


class SupabaseStorageError(Exception):
    """Raised when a Supabase Storage operation fails."""


class SupabaseStorageConfigError(SupabaseStorageError):
    """Raised when required Supabase Storage configuration is missing."""


class SupabaseStorageService:
    def __init__(self):
        self.bucket = AVATAR_BUCKET

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
                f"{exc}. Executez le script SQL d'avatars dans l'editeur SQL Supabase "
                "avec un role proprietaire si vous voulez activer les policies automatiquement."
            )

    def _bootstrap_storage_objects(self) -> None:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
                    VALUES (:bucket_id, :bucket_name, TRUE, :file_size_limit, :allowed_mime_types)
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

            for statement in self._policy_statements():
                connection.execute(text(statement))

    def _policy_statements(self) -> list[str]:
        subject_expr = "coalesce(auth.jwt() ->> 'sub', auth.uid()::text)"
        path_expr = f"(storage.foldername(name))[1] = {subject_expr}"
        return [
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_policies
                    WHERE schemaname = 'storage'
                      AND tablename = 'objects'
                      AND policyname = 'avatars_select_own'
                ) THEN
                    CREATE POLICY avatars_select_own
                    ON storage.objects
                    FOR SELECT
                    TO authenticated
                    USING (bucket_id = '{self.bucket}' AND {path_expr});
                END IF;
            END
            $$;
            """,
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_policies
                    WHERE schemaname = 'storage'
                      AND tablename = 'objects'
                      AND policyname = 'avatars_insert_own'
                ) THEN
                    CREATE POLICY avatars_insert_own
                    ON storage.objects
                    FOR INSERT
                    TO authenticated
                    WITH CHECK (bucket_id = '{self.bucket}' AND {path_expr});
                END IF;
            END
            $$;
            """,
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_policies
                    WHERE schemaname = 'storage'
                      AND tablename = 'objects'
                      AND policyname = 'avatars_update_own'
                ) THEN
                    CREATE POLICY avatars_update_own
                    ON storage.objects
                    FOR UPDATE
                    TO authenticated
                    USING (bucket_id = '{self.bucket}' AND {path_expr})
                    WITH CHECK (bucket_id = '{self.bucket}' AND {path_expr});
                END IF;
            END
            $$;
            """,
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_policies
                    WHERE schemaname = 'storage'
                      AND tablename = 'objects'
                      AND policyname = 'avatars_delete_own'
                ) THEN
                    CREATE POLICY avatars_delete_own
                    ON storage.objects
                    FOR DELETE
                    TO authenticated
                    USING (bucket_id = '{self.bucket}' AND {path_expr});
                END IF;
            END
            $$;
            """,
        ]

    def upload_avatar(self, user_id: int, content: bytes, content_type: str) -> str:
        extension = ALLOWED_AVATAR_MIME_TYPES.get(content_type)
        if not extension:
            raise SupabaseStorageError("Choisissez une image JPG, PNG ou WEBP.")
        if len(content) > MAX_AVATAR_SIZE_BYTES:
            raise SupabaseStorageError("L'image ne doit pas depasser 2 Mo.")

        self.bootstrap_avatar_storage()

        supabase_url = self._resolve_supabase_url()
        service_role_key = self._service_role_key()
        object_path = f"{user_id}/profile.{extension}"
        encoded_object_path = parse.quote(object_path, safe="/.")

        upload_request = request.Request(
            url=f"{supabase_url}/storage/v1/object/{self.bucket}/{encoded_object_path}",
            data=content,
            headers={
                "Authorization": f"Bearer {service_role_key}",
                "apikey": service_role_key,
                "Content-Type": content_type,
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

        return self.public_avatar_url(user_id, extension)

    def public_avatar_url(self, user_id: int, extension: str) -> str:
        object_path = parse.quote(f"{user_id}/profile.{extension}", safe="/.")
        return f"{self._resolve_supabase_url()}/storage/v1/object/public/{self.bucket}/{object_path}"


avatar_storage_service = SupabaseStorageService()
