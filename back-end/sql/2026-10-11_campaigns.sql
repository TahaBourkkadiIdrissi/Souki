-- New tables only. Run once in Supabase SQL Editor before deploying the new images.
BEGIN;
CREATE TABLE IF NOT EXISTS public.t_campaigns (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(48) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    destination VARCHAR(1000) NOT NULL,
    source VARCHAR(80) NOT NULL DEFAULT 'flyer',
    medium VARCHAR(80) NOT NULL DEFAULT 'qr',
    campaign VARCHAR(80) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.t_campaign_visits (
    id VARCHAR(32) PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES public.t_campaigns(id),
    visitor_hash VARCHAR(64) NOT NULL,
    visited_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_campaign_visit_date ON public.t_campaign_visits(campaign_id, visited_at);
CREATE TABLE IF NOT EXISTS public.t_campaign_orders (
    order_id INTEGER PRIMARY KEY REFERENCES public.t_commandes(id),
    visit_id VARCHAR(32) NOT NULL REFERENCES public.t_campaign_visits(id)
);
CREATE INDEX IF NOT EXISTS ix_campaign_orders_visit ON public.t_campaign_orders(visit_id);
-- Access via the authenticated FastAPI server, never directly via the public Supabase API.
ALTER TABLE public.t_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_campaign_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_campaign_orders ENABLE ROW LEVEL SECURITY;
COMMIT;
