from sqlalchemy import text

from config import engine


class JITSchemaSyncService:
    """
    Ajoute les colonnes JIT régional aux tables existantes.
    Doit s'exécuter après Base.metadata.create_all() pour que t_zones_jit existe.
    """

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return

        with engine.begin() as conn:
            # 1. S'assurer que t_zones_jit existe (fallback si create_all n'a pas tourné)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS t_zones_jit (
                    id             SERIAL PRIMARY KEY,
                    nom_ville      VARCHAR(100) NOT NULL,
                    lat_centre     DOUBLE PRECISION NOT NULL,
                    lng_centre     DOUBLE PRECISION NOT NULL,
                    rayon_km       DOUBLE PRECISION NOT NULL DEFAULT 25.0,
                    fournisseur_id INTEGER REFERENCES t_fournisseurs(user_id) ON DELETE SET NULL,
                    actif          BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_zones_jit_actif ON t_zones_jit(actif)"
            ))

            # 2. Ajouter zone_id à t_jit_logs
            conn.execute(text(
                "ALTER TABLE t_jit_logs ADD COLUMN IF NOT EXISTS zone_id INTEGER"
            ))
            conn.execute(text(
                "ALTER TABLE t_jit_logs ADD COLUMN IF NOT EXISTS nom_ville VARCHAR(100)"
            ))

            # 3. Ajouter la contrainte FK (idempotente via DO $$)
            conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_jit_logs_zone'
                    ) THEN
                        ALTER TABLE t_jit_logs
                            ADD CONSTRAINT fk_jit_logs_zone
                            FOREIGN KEY (zone_id) REFERENCES t_zones_jit(id) ON DELETE SET NULL;
                    END IF;
                END $$
            """))

            # 4. Index de performance
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_jit_logs_zone ON t_jit_logs(zone_id)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_jit_logs_date_zone "
                "ON t_jit_logs(date_execution, zone_id)"
            ))
