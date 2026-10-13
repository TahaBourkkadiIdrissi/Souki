-- Apply after 2026-10-11_campaigns.sql, before deploying backend/client/admin.
BEGIN;
CREATE TABLE IF NOT EXISTS public.t_campaign_links (
    slug VARCHAR(48) PRIMARY KEY CHECK (slug = lower(slug)),
    campaign_id INTEGER NOT NULL REFERENCES public.t_campaigns(id)
);
CREATE INDEX IF NOT EXISTS ix_t_campaign_links_campaign_id ON public.t_campaign_links(campaign_id);
CREATE TABLE IF NOT EXISTS public.t_campaign_lifecycle (
    campaign_id INTEGER PRIMARY KEY REFERENCES public.t_campaigns(id),
    canonical_slug VARCHAR(48) NOT NULL,
    deleted_at TIMESTAMP NULL
);
-- Reserve existing identifiers forever. A conflicting owner must abort migration.
DO $$
BEGIN
    IF EXISTS (
        SELECT lower(slug) FROM public.t_campaigns GROUP BY lower(slug) HAVING count(*) > 1
    ) OR EXISTS (
        SELECT 1 FROM public.t_campaigns c JOIN public.t_campaign_links l ON l.slug = lower(c.slug)
        WHERE l.campaign_id <> c.id
    ) THEN
        RAISE EXCEPTION 'Campaign slug collision: resolve before migration';
    END IF;
END $$;
INSERT INTO public.t_campaign_links(slug, campaign_id)
SELECT lower(slug), id FROM public.t_campaigns ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.t_campaign_lifecycle(campaign_id, canonical_slug)
SELECT id, lower(slug) FROM public.t_campaigns ON CONFLICT (campaign_id) DO NOTHING;
ALTER TABLE public.t_campaign_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_campaign_lifecycle ENABLE ROW LEVEL SECURITY;
COMMIT;
