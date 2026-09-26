from sqlalchemy import text

from config import engine


class ProfileSchemaSyncService:
    """Add name columns to existing user tables (create_all does not alter tables)."""

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return

        with engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE IF EXISTS public.t_users "
                "ADD COLUMN IF NOT EXISTS prenom VARCHAR(100), "
                "ADD COLUMN IF NOT EXISTS nom VARCHAR(100)"
            ))
