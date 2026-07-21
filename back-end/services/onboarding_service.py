from datetime import datetime, timezone

from config import LocalSession
from dao.user_dao import UserDao


class OnboardingService:
    """Marque la fin de l'onboarding sur le compte lui-meme.

    L'etat vit cote serveur (t_users.onboarding_completed_at) et non plus dans le
    localStorage du navigateur : l'onboarding ne se declenche donc que pour un
    compte nouvellement cree, et jamais a nouveau, quel que soit l'appareil.
    """

    def __init__(self, user_dao: UserDao | None = None) -> None:
        self._user_dao = user_dao or UserDao()

    def complete(self, user_id: int) -> bool:
        db = LocalSession()
        try:
            user = self._user_dao.read(db, user_id)
            if not user:
                return False

            # Idempotent : on conserve la premiere date de completion.
            if user.onboarding_completed_at is None:
                user.onboarding_completed_at = datetime.now(timezone.utc)
                db.commit()

            return True
        finally:
            db.close()
