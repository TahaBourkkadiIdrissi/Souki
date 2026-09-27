"""Apply the versioned SEO migration explicitly before API deployment."""
import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    migration = Path(__file__).resolve().parents[1] / "sql/2026-09-27_product_public_updated_at.sql"
    if not args.apply:
        print(f"Dry run: {migration.name}. Historical unknown dates remain NULL. Use --apply to execute.")
        return
    from config import engine
    if engine.dialect.name != "postgresql":
        raise RuntimeError("The SEO migration requires PostgreSQL")
    connection = engine.raw_connection()
    driver = connection.driver_connection
    previous_autocommit = driver.autocommit
    try:
        # The versioned SQL owns its atomic BEGIN/COMMIT transaction.
        driver.autocommit = True
        with connection.cursor() as cursor:
            cursor.execute(migration.read_text(encoding="utf-8"))
        print(f"Applied {migration.name}")
    finally:
        try:
            driver.rollback()  # Also exits an explicit transaction if the SQL failed.
            driver.autocommit = previous_autocommit
        finally:
            connection.close()


if __name__ == "__main__":
    main()
