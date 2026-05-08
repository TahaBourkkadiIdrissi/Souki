-- SOUKI - Migration Pricing Produits
-- Date : Mai 2026
-- Ne jamais modifier product_entity.py directement

ALTER TABLE "T_Product"
ADD COLUMN IF NOT EXISTS marge_cible       FLOAT   DEFAULT 0.25,
ADD COLUMN IF NOT EXISTS coussin_securite  FLOAT   DEFAULT 0.10,
ADD COLUMN IF NOT EXISTS niveau            INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS volatilite        VARCHAR(20) DEFAULT 'STABLE',
ADD COLUMN IF NOT EXISTS prix_gros_saisi   FLOAT   DEFAULT NULL,
ADD COLUMN IF NOT EXISTS prix_affiche      FLOAT   DEFAULT NULL;

-- Contrainte niveau
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_produit_niveau'
    ) THEN
        ALTER TABLE "T_Product"
        ADD CONSTRAINT ck_produit_niveau
        CHECK (niveau IN (1, 2, 3));
    END IF;
END $$;

-- Contrainte volatilite
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_produit_volatilite'
    ) THEN
        ALTER TABLE "T_Product"
        ADD CONSTRAINT ck_produit_volatilite
        CHECK (volatilite IN ('STABLE', 'VARIABLE', 'SAISONNIER'));
    END IF;
END $$;

-- Valeurs initiales intelligentes selon les produits existants
-- Niveau 1 : patates, oignons, tomates, carottes
-- Niveau 2 : courgettes, aubergines, poivrons, concombre
-- Niveau 3 : herbes, avocats, citrons, oeufs beldi
-- A ajuster manuellement via /admin/pricing apres migration
