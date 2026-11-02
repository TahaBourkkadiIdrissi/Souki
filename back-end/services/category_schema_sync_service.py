from pathlib import Path

from sqlalchemy import text
from config import engine


class CategorySchemaSyncService:
    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return
        sql = (Path(__file__).parents[1] / "sql/2026-10-28_product_categories.sql").read_text(encoding="utf-8")
        with engine.begin() as connection:
            connection.execute(text(sql.replace("BEGIN;", "").replace("COMMIT;", "")))
