-- Apply before deploying the API. Existing dates remain unknown (NULL).
BEGIN;
ALTER TABLE public."T_Product"
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.souki_product_public_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.updated_at := CURRENT_TIMESTAMP;
    ELSIF ROW(NEW.nom_fr, NEW.nom_darija, NEW.unite, NEW.image_url,
              COALESCE(NEW.prix_affiche, NEW.prix_kg), NEW.is_active,
              NEW.stock > 0, NEW.niveau, NEW.prix_gros_saisi, NEW.prix_khddar_reel)
          IS DISTINCT FROM
          ROW(OLD.nom_fr, OLD.nom_darija, OLD.unite, OLD.image_url,
              COALESCE(OLD.prix_affiche, OLD.prix_kg), OLD.is_active,
              OLD.stock > 0, OLD.niveau, OLD.prix_gros_saisi, OLD.prix_khddar_reel) THEN
        NEW.updated_at := CURRENT_TIMESTAMP;
    ELSE
        NEW.updated_at := OLD.updated_at;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_public_updated_at ON public."T_Product";
CREATE TRIGGER product_public_updated_at
BEFORE INSERT OR UPDATE ON public."T_Product"
FOR EACH ROW EXECUTE FUNCTION public.souki_product_public_updated_at();
COMMIT;
