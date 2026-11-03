from sqlalchemy import text

from config import engine


class ArabicLabelsSchemaSyncService:
    """Arabic versions of texts typed in the admin (catalogue sections, SOUKI baskets). Empty = French text shown."""

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return
        with engine.begin() as connection:
            for statement in (
                'ALTER TABLE IF EXISTS public.t_categories ADD COLUMN IF NOT EXISTS nom_ar VARCHAR(80)',
                'ALTER TABLE IF EXISTS public.t_paniers_souki ADD COLUMN IF NOT EXISTS nom_ar VARCHAR(120)',
                'ALTER TABLE IF EXISTS public.t_paniers_souki ADD COLUMN IF NOT EXISTS description_ar VARCHAR(1000)',
            ):
                connection.execute(text(statement))
