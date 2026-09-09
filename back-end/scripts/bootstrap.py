"""Explicit database initialization, never run by the HTTP container.

Inspect the target environment and back up Supabase before invoking --apply.
Uses the existing idempotent schema services; does not drop supplier tables.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Apply schema initialization to the configured database")
    args = parser.parse_args()
    if not args.apply:
        parser.error("Review the target database and pass --apply explicitly.")
    from main import sync_database_schema, bootstrap_database_data
    sync_database_schema()
    bootstrap_database_data()


if __name__ == "__main__":
    main()
