from sqlalchemy import text

from config import engine


class ProductDescriptionSchemaSyncService:
    """Add editable descriptions and Arabic-script names without changing existing catalogue data."""

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return
        with engine.begin() as connection:
            connection.execute(text(
                'ALTER TABLE IF EXISTS public."T_Product" '
                'ADD COLUMN IF NOT EXISTS description TEXT'
            ))
            connection.execute(text(
                'ALTER TABLE IF EXISTS public."T_Product" '
                'ADD COLUMN IF NOT EXISTS nom_ar VARCHAR(100)'
            ))
            connection.execute(text(
                'ALTER TABLE IF EXISTS public."T_Product" '
                'ADD COLUMN IF NOT EXISTS description_ar TEXT'
            ))
