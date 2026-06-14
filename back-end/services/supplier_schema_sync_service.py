from sqlalchemy import text

from config import engine


class SupplierSchemaSyncService:

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return

        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS t_fournisseurs (
                      user_id         integer           NOT NULL,
                      shop_name       character varying NOT NULL,
                      shop_slug       character varying UNIQUE,
                      description     text,
                      phone           character varying,
                      address         text,
                      ville           character varying,
                      code_postal     character varying,
                      latitude        double precision,
                      longitude       double precision,
                      siret           character varying,
                      logo_url        character varying,
                      couverture_url  character varying,
                      horaires        jsonb,
                      rating          double precision  DEFAULT 0,
                      nb_avis         integer           DEFAULT 0,
                      statut          character varying NOT NULL DEFAULT 'PENDING'
                        CHECK (statut IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')),
                      rejected_reason text,
                      validated_by    integer,
                      validated_at    timestamp with time zone,
                      created_at      timestamp with time zone DEFAULT now(),
                      updated_at      timestamp with time zone DEFAULT now(),
                      CONSTRAINT t_fournisseurs_pkey PRIMARY KEY (user_id),
                      CONSTRAINT t_fournisseurs_user_id_fkey FOREIGN KEY (user_id) REFERENCES t_users(id),
                      CONSTRAINT t_fournisseurs_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES t_users(id)
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_fournisseurs_statut ON t_fournisseurs(statut)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_fournisseurs_ville ON t_fournisseurs(ville)"))
            connection.execute(text('ALTER TABLE "T_Product" ADD COLUMN IF NOT EXISTS fournisseur_id integer'))
            connection.execute(
                text(
                    """
                    DO $$
                    BEGIN
                      IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'fk_product_fournisseur'
                      ) THEN
                        ALTER TABLE "T_Product"
                          ADD CONSTRAINT fk_product_fournisseur
                          FOREIGN KEY (fournisseur_id) REFERENCES t_fournisseurs(user_id);
                      END IF;
                    END $$;
                    """
                )
            )
            connection.execute(text('CREATE INDEX IF NOT EXISTS idx_product_fournisseur ON "T_Product"(fournisseur_id)'))
