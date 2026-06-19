from sqlalchemy import text

from config import engine


class FournisseurProduitSchemaSyncService:

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return

        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS t_fournisseur_produits (
                      id             serial PRIMARY KEY,
                      fournisseur_id integer NOT NULL REFERENCES t_fournisseurs(user_id),
                      produit_id     integer NOT NULL REFERENCES "T_Product"(id),
                      prix_gros      double precision,
                      stock          double precision DEFAULT 0,
                      is_active      boolean DEFAULT true,
                      created_at     timestamptz DEFAULT now(),
                      updated_at     timestamptz DEFAULT now(),
                      CONSTRAINT uq_fournisseur_produit UNIQUE (fournisseur_id, produit_id)
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_fp_fournisseur ON t_fournisseur_produits(fournisseur_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_fp_produit     ON t_fournisseur_produits(produit_id)"))
            connection.execute(
                text(
                    """
                    INSERT INTO t_fournisseur_produits (fournisseur_id, produit_id, is_active)
                    SELECT fournisseur_id, id, is_active FROM "T_Product" WHERE fournisseur_id IS NOT NULL
                    ON CONFLICT (fournisseur_id, produit_id) DO NOTHING
                    """
                )
            )
