from sqlalchemy import text

from config import engine


class OnboardingSchemaSyncService:
    """
    Colonne t_users.onboarding_completed_at : marque la fin de l'onboarding.

    NULL signifie « compte jamais onboarde ». Les comptes deja existants au moment
    de l'ajout de la colonne sont donc backfilles avec leur date de creation : sans
    ce backfill, tous les utilisateurs actuels se verraient reproposer l'onboarding
    une fois, alors qu'il ne doit s'afficher que pour les comptes nouvellement crees.
    """

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return

        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE IF EXISTS public.t_users "
                "ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ"
            ))
            # Backfill unique : ne cible que les comptes anterieurs a cette migration.
            # Un compte cree apres coup garde NULL et verra bien l'onboarding.
            conn.execute(text(
                "UPDATE public.t_users "
                "SET onboarding_completed_at = COALESCE(created_at, NOW()) "
                "WHERE onboarding_completed_at IS NULL "
                "  AND created_at IS NOT NULL "
                "  AND created_at < TIMESTAMPTZ '2026-07-21 00:00:00+00'"
            ))
