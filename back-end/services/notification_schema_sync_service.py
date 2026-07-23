from sqlalchemy import text

from config import engine


class NotificationSchemaSyncService:
    """Aligne t_notification_outbox sur le modele etendu (routage + retries).

    La table existait avant l'ajout des notifications multi-canal :
    `Base.metadata.create_all` ne sait pas ajouter de colonnes a une table
    existante, d'ou ce sync explicite, idempotent, joue au demarrage.
    """

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return

        with engine.begin() as connection:
            NotificationSchemaSyncService._sync_outbox_columns(connection)
            NotificationSchemaSyncService._sync_outbox_indexes(connection)

    @staticmethod
    def _sync_outbox_columns(connection) -> None:
        connection.execute(
            text(
                """
                ALTER TABLE t_notification_outbox
                    ADD COLUMN IF NOT EXISTS user_id INTEGER,
                    ADD COLUMN IF NOT EXISTS event VARCHAR(60),
                    ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(180),
                    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS last_error TEXT,
                    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ
                """
            )
        )
        # Les lignes anterieures n'ont pas de date de prochaine tentative :
        # sans cela le worker (qui filtre sur next_attempt_at <= now) les ignorerait.
        connection.execute(
            text(
                """
                UPDATE t_notification_outbox
                SET next_attempt_at = created_at
                WHERE next_attempt_at IS NULL
                """
            )
        )

    @staticmethod
    def _sync_outbox_indexes(connection) -> None:
        # Index unique partiel : plusieurs lignes sans cle d'idempotence restent
        # possibles (evenements techniques WEBSOCKET), une seule par cle sinon.
        connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS ux_t_notification_outbox_dedupe_key
                ON t_notification_outbox (dedupe_key)
                WHERE dedupe_key IS NOT NULL
                """
            )
        )
        # Index de travail du worker : (status, next_attempt_at) couvre le
        # SELECT ... WHERE status = 'PENDING' AND next_attempt_at <= now().
        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_t_notification_outbox_pending
                ON t_notification_outbox (status, next_attempt_at)
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_t_push_subscriptions_user_active
                ON t_push_subscriptions (user_id)
                WHERE revoked_at IS NULL
                """
            )
        )
