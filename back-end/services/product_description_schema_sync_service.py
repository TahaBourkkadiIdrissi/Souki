from sqlalchemy import text

from config import engine


class ProductDescriptionSchemaSyncService:
    """Add editable descriptions without changing existing catalogue data."""

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return
        with engine.begin() as connection:
            connection.execute(text(
                'ALTER TABLE IF EXISTS public."T_Product" '
                'ADD COLUMN IF NOT EXISTS description TEXT'
            ))
