from sqlalchemy import text

from config import engine


class LogisticsSchemaSyncService:

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return

        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    ALTER TABLE t_commandes
                    ADD COLUMN IF NOT EXISTS fournisseur_id INTEGER NULL
                    """
                )
            )
            connection.execute(
                text(
                    """
                    ALTER TABLE t_tournees
                    ADD COLUMN IF NOT EXISTS fournisseur_id INTEGER NULL,
                    ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION NULL,
                    ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION NULL,
                    ADD COLUMN IF NOT EXISTS ramasse_at TIMESTAMPTZ NULL
                    """
                )
            )
            connection.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS idx_commandes_fournisseur
                    ON t_commandes (fournisseur_id)
                    """
                )
            )
            connection.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS idx_tournees_fournisseur
                    ON t_tournees (fournisseur_id)
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
                            FROM pg_constraint
                            WHERE conname = 'fk_t_commandes_fournisseur'
                        ) THEN
                            ALTER TABLE t_commandes
                            ADD CONSTRAINT fk_t_commandes_fournisseur
                            FOREIGN KEY (fournisseur_id)
                            REFERENCES t_fournisseurs(user_id)
                            ON DELETE SET NULL;
                        END IF;

                        IF NOT EXISTS (
                            SELECT 1
                            FROM pg_constraint
                            WHERE conname = 'fk_t_tournees_fournisseur'
                        ) THEN
                            ALTER TABLE t_tournees
                            ADD CONSTRAINT fk_t_tournees_fournisseur
                            FOREIGN KEY (fournisseur_id)
                            REFERENCES t_fournisseurs(user_id)
                            ON DELETE SET NULL;
                        END IF;
                    END $$;
                    """
                )
            )
