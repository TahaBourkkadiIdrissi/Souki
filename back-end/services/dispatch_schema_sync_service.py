from sqlalchemy import text

from config import engine


class DispatchSchemaSyncService:

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return

        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    ALTER TABLE t_commandes
                    ADD COLUMN IF NOT EXISTS tournee_id INTEGER NULL,
                    ADD COLUMN IF NOT EXISTS ordre_passage INTEGER NULL
                    """
                )
            )
            connection.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_t_commandes_tournee_id
                    ON t_commandes (tournee_id)
                    """
                )
            )
            connection.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_t_commandes_tournee_ordre
                    ON t_commandes (tournee_id, ordre_passage)
                    """
                )
            )
            connection.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1
                            FROM pg_constraint AS constraint_info
                            JOIN pg_class AS source_table
                              ON source_table.oid = constraint_info.conrelid
                            JOIN pg_class AS target_table
                              ON target_table.oid = constraint_info.confrelid
                            JOIN pg_attribute AS source_column
                              ON source_column.attrelid = source_table.oid
                             AND source_column.attnum = ANY(constraint_info.conkey)
                            WHERE constraint_info.contype = 'f'
                              AND source_table.relname = 't_commandes'
                              AND target_table.relname = 't_tournees'
                              AND source_column.attname = 'tournee_id'
                        ) THEN
                            ALTER TABLE t_commandes
                            ADD CONSTRAINT fk_t_commandes_tournee
                            FOREIGN KEY (tournee_id)
                            REFERENCES t_tournees(id)
                            ON DELETE SET NULL;
                        END IF;
                    END $$;
                    """
                )
            )
