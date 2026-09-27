-- Apply before deploying the backend when SOUKI_SKIP_DB_INIT is enabled.
ALTER TABLE public."T_Product"
    ADD COLUMN IF NOT EXISTS description TEXT;
