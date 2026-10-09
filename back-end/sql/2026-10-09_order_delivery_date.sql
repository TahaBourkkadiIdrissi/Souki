BEGIN;
ALTER TABLE public.t_jit_logs ADD COLUMN IF NOT EXISTS date_livraison DATE;
ALTER TABLE public.t_commandes ADD COLUMN IF NOT EXISTS date_livraison DATE;
-- Assigned orders keep their actual route date.
UPDATE public.t_commandes c SET date_livraison = t.date_tournee
FROM public.t_tournees t WHERE c.tournee_id = t.id AND c.date_livraison IS NULL;
-- Legacy timestamps are stored as UTC without timezone. Drafts are not deliveries.
UPDATE public.t_commandes SET date_livraison =
    ((date_commande AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Casablanca')::date
    + CASE WHEN EXTRACT(HOUR FROM ((date_commande AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Casablanca')) >= 8 THEN 1 ELSE 0 END
WHERE date_livraison IS NULL AND UPPER(COALESCE(statut, '')) <> 'BROUILLON';
CREATE INDEX IF NOT EXISTS ix_t_commandes_delivery_batch ON public.t_commandes(date_livraison, statut);
CREATE INDEX IF NOT EXISTS ix_t_jit_logs_delivery_batch ON public.t_jit_logs(date_livraison, zone_id, statut);
COMMIT;
