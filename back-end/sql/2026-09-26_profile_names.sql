-- Apply before deploying the API where automatic schema sync is disabled.
ALTER TABLE IF EXISTS public.t_users
  ADD COLUMN IF NOT EXISTS prenom VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nom VARCHAR(100);
