from sqlalchemy import text

from config import engine


ALLOWED_COMMANDE_STATUSES = (
    "BROUILLON",
    "EN_ATTENTE",
    "CONFIRMEE",
    "VERROUILLEE",
    "A_LIVRER",
    "EN_ROUTE",
    "LIVRE",
    "ABSENT",
    "REFUS",
    "ANNULEE",
)


class DeliverySchemaSyncService:

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return

        allowed_statuses_sql = ", ".join(f"'{status}'" for status in ALLOWED_COMMANDE_STATUSES)

        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    UPDATE t_commandes
                    SET statut = CASE
                        WHEN statut IS NULL OR btrim(statut) = '' THEN 'EN_ATTENTE'
                        WHEN upper(btrim(statut)) = 'BROUILLON' THEN 'BROUILLON'
                        WHEN upper(btrim(statut)) IN ('EN_ATTENTE', 'EN ATTENTE') THEN 'EN_ATTENTE'
                        WHEN upper(btrim(statut)) IN ('CONFIRMEE', 'CONFIRMÉE', 'CONFIRMÃ‰E') THEN 'CONFIRMEE'
                        WHEN upper(btrim(statut)) IN ('VERROUILLEE', 'VERROUILLÉE', 'VERROUILLÃ‰E') THEN 'VERROUILLEE'
                        WHEN upper(btrim(statut)) IN ('A_LIVRER', 'A LIVRER') THEN 'A_LIVRER'
                        WHEN upper(btrim(statut)) IN ('EN_ROUTE', 'EN ROUTE', 'EN_COURS_DE_LIVRAISON') THEN 'EN_ROUTE'
                        WHEN upper(btrim(statut)) IN ('LIVRE', 'LIVREE', 'LIVRÉE', 'LIVRÃ‰E', 'DELIVERED') THEN 'LIVRE'
                        WHEN upper(btrim(statut)) = 'ABSENT' THEN 'ABSENT'
                        WHEN upper(btrim(statut)) IN ('REFUS', 'REFUSE', 'REFUSÉ', 'REFUSÉE', 'REFUSÃ‰', 'REFUSÃ‰E', 'REFUSED') THEN 'REFUS'
                        WHEN upper(btrim(statut)) IN ('ANNULE', 'ANNULEE', 'ANNULÉ', 'ANNULÉE', 'ANNULÃ‰', 'ANNULÃ‰E', 'CANCELLED', 'CANCELED') THEN 'ANNULEE'
                        ELSE upper(replace(btrim(statut), ' ', '_'))
                    END
                    """
                )
            )

            connection.execute(
                text(
                    """
                    ALTER TABLE t_commandes
                    ADD COLUMN IF NOT EXISTS enroute_at TIMESTAMPTZ NULL,
                    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ NULL,
                    ADD COLUMN IF NOT EXISTS absent_at TIMESTAMPTZ NULL,
                    ADD COLUMN IF NOT EXISTS payment_validated BOOLEAN DEFAULT false,
                    ADD COLUMN IF NOT EXISTS status_version INTEGER
                    """
                )
            )
            connection.execute(
                text(
                    """
                    UPDATE t_commandes AS c
                    SET payment_validated = COALESCE(p.valide, c.payment_validated, false)
                    FROM t_paiements AS p
                    WHERE p.commande_id = c.id
                    """
                )
            )
            connection.execute(
                text(
                    """
                    UPDATE t_commandes
                    SET payment_validated = false
                    WHERE payment_validated IS NULL
                    """
                )
            )
            connection.execute(text("ALTER TABLE t_commandes ALTER COLUMN payment_validated SET DEFAULT false"))
            connection.execute(
                text(
                    """
                    UPDATE t_commandes
                    SET status_version = 1
                    WHERE status_version IS NULL OR status_version < 1
                    """
                )
            )
            connection.execute(text("ALTER TABLE t_commandes ALTER COLUMN status_version SET DEFAULT 1"))
            connection.execute(text("ALTER TABLE t_commandes ALTER COLUMN status_version SET NOT NULL"))

            invalid_statuses = [
                row[0]
                for row in connection.execute(
                    text(
                        f"""
                        SELECT DISTINCT COALESCE(statut, '<NULL>')
                        FROM t_commandes
                        WHERE COALESCE(statut, '<NULL>') NOT IN ({allowed_statuses_sql}, '<NULL>')
                        ORDER BY 1
                        """
                    )
                ).all()
            ]

            if invalid_statuses:
                print(
                    "[DeliverySchemaSync] Constraint ck_t_commandes_statut_allowed skipped. "
                    f"Unexpected statuses still present: {', '.join(str(value) for value in invalid_statuses)}"
                )
                return

            connection.execute(
                text(
                    """
                    ALTER TABLE t_commandes
                    DROP CONSTRAINT IF EXISTS ck_t_commandes_statut_allowed
                    """
                )
            )
            connection.execute(
                text(
                    f"""
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1
                            FROM pg_constraint
                            WHERE conname = 'ck_t_commandes_statut_allowed'
                        ) THEN
                            ALTER TABLE t_commandes
                            DROP CONSTRAINT ck_t_commandes_statut_allowed;
                        END IF;

                        ALTER TABLE t_commandes
                            ADD CONSTRAINT ck_t_commandes_statut_allowed
                            CHECK (statut IN ({allowed_statuses_sql}));
                    END $$;
                    """
                )
            )
