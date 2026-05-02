from sqlalchemy import text

from config import engine


class WalletSchemaSyncService:

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return

        with engine.begin() as connection:
            WalletSchemaSyncService._sync_wallet_transactions_schema(connection)

    @staticmethod
    def _sync_wallet_transactions_schema(connection) -> None:
        connection.execute(
            text(
                """
                ALTER TABLE t_transactions_wallet
                DROP CONSTRAINT IF EXISTS t_transactions_wallet_wallet_id_fkey
                """
            )
        )
        connection.execute(
            text(
                """
                DO $$
                DECLARE
                    wallet_id_data_type TEXT;
                BEGIN
                    SELECT data_type
                    INTO wallet_id_data_type
                    FROM information_schema.columns
                    WHERE table_name = 't_transactions_wallet'
                      AND column_name = 'wallet_id';

                    IF wallet_id_data_type IS DISTINCT FROM 'uuid' THEN
                        IF EXISTS (SELECT 1 FROM t_transactions_wallet) THEN
                            ALTER TABLE t_transactions_wallet
                            ADD COLUMN IF NOT EXISTS wallet_id_souki UUID;

                            UPDATE t_transactions_wallet AS tx
                            SET wallet_id_souki = souki_wallet.id
                            FROM t_wallets AS legacy_wallet
                            JOIN wallets AS souki_wallet
                              ON souki_wallet.user_id = legacy_wallet.user_id
                            WHERE tx.wallet_id = legacy_wallet.id
                              AND tx.wallet_id_souki IS NULL;

                            IF EXISTS (
                                SELECT 1
                                FROM t_transactions_wallet
                                WHERE wallet_id_souki IS NULL
                            ) THEN
                                RAISE EXCEPTION
                                    'Migration t_transactions_wallet impossible: transactions legacy sans SoukiWallet correspondant.';
                            END IF;

                            ALTER TABLE t_transactions_wallet DROP COLUMN wallet_id;
                            ALTER TABLE t_transactions_wallet RENAME COLUMN wallet_id_souki TO wallet_id;
                        ELSE
                            ALTER TABLE t_transactions_wallet
                            ALTER COLUMN wallet_id TYPE UUID USING NULL::uuid;
                        END IF;
                    END IF;
                END $$;
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE t_transactions_wallet
                ALTER COLUMN wallet_id SET NOT NULL
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_t_transactions_wallet_wallet_id
                ON t_transactions_wallet (wallet_id)
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
                        WHERE conname = 'fk_t_transactions_wallet_souki_wallet'
                    ) THEN
                        ALTER TABLE t_transactions_wallet
                        ADD CONSTRAINT fk_t_transactions_wallet_souki_wallet
                        FOREIGN KEY (wallet_id) REFERENCES wallets(id);
                    END IF;
                END $$;
                """
            )
        )
