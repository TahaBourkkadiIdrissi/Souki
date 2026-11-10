"""Entree de l'app iOS (AuthFlow, design 2027).

B12 — `check_email` : dit seulement si un compte utilisable existe pour cette adresse, et s'il a un
mot de passe (sinon il a ete cree avec Google). Ni nom, ni identifiant, ni autre donnee : la route
est limitee en debit par IP dans le controller pour eviter qu'on teste des adresses en masse.

Renouvellement de session — `refresh_session` : un client de l'app reste connecte tant qu'il ne se
deconnecte pas. Le jeton (24 h) est renouvele s'il est signe par SOUKI, si sa session est toujours
active (une deconnexion, « Déconnecter tous les appareils » ou la suppression du compte la ferment)
et s'il a expire depuis moins de 30 jours. La session garde son identite (appareil, lieu) : seul
le jeton change, l'ancien ne vaut plus rien.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import ALGORITHM, SECRET_KEY
from dto.auth_mobile_dto import CheckEmailResponse, RefreshSessionResponse
from interfaces.auth_mobile_dao_interface import IAuthMobileDao
from interfaces.auth_mobile_service_interface import IAuthMobileService
from security import create_access_token
from services.authorization_service import AuthorizationService
from services.user_session_service import UserSessionService

# Inactivite maximale : au-dela de 30 jours sans ouvrir l'app, il faut se reconnecter.
REFRESH_GRACE = timedelta(days=30)
INVALID_SESSION = "Session expiree ou invalidee"


def _providers(auth_provider: str | None) -> list[str]:
    raw = (auth_provider or "local").replace(";", ",")
    return sorted({part.strip().lower() for part in raw.split(",") if part.strip()})


class AuthMobileService(IAuthMobileService):
    def __init__(self, dao: IAuthMobileDao, session: Session):
        self.dao, self.session = dao, session

    def check_email(self, email: str) -> CheckEmailResponse:
        user = self.dao.find_user_by_email(self.session, email)
        providers = _providers(user.auth_provider) if user else []
        usable = bool(user and user.is_active and (user.is_verified or "google" in providers))
        if not usable:
            # Compte absent, supprime (e-mail anonymise) ou jamais verifie : l'app propose de le creer ;
            # l'inscription redit elle-meme si un code attend deja.
            return CheckEmailResponse(exists=False, has_password=False, providers=[])
        return CheckEmailResponse(exists=True, has_password=bool(user.password), providers=providers)

    def refresh_session(self, token: str) -> RefreshSessionResponse:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
            user_id = int(payload["sub"])
            expires_at = datetime.fromtimestamp(int(payload["exp"]), tz=timezone.utc)
        except (JWTError, KeyError, TypeError, ValueError):
            raise HTTPException(401, INVALID_SESSION)
        if datetime.now(timezone.utc) - expires_at > REFRESH_GRACE:
            raise HTTPException(401, INVALID_SESSION)

        try:
            record = self.dao.find_active_session(self.session, UserSessionService._hash_token(token))
            user = self.dao.find_user(self.session, user_id) if record else None
            if record is None or user is None or not user.is_active or record.user_id != user_id:
                self.session.rollback()
                raise HTTPException(401, INVALID_SESSION)

            principal = AuthorizationService(self.session).build_principal(user_id)
            role = payload.get("role") if payload.get("role") and principal.has_role(payload.get("role")) else principal.primary_role
            new_token = create_access_token(
                {
                    "sub": str(user.id),
                    "email": user.email,
                    "role": role,
                    "roles": sorted(principal.roles),
                    "legacy_role": principal.legacy_role,
                    "default_dashboard": principal.default_dashboard,
                }
            )
            self.dao.rotate_session_token(self.session, record, UserSessionService._hash_token(new_token))
            self.session.commit()
            return RefreshSessionResponse(access_token=new_token)
        except HTTPException:
            raise
        except Exception:
            self.session.rollback()
            raise
