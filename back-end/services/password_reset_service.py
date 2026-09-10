import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from jose import JWTError, jwt
from sqlalchemy import func

from config import ALGORITHM, LocalSession, SECRET_KEY
from entities.user_entity import User
from entities.user_session_entity import UserSession
from security import hash_password, verify_password
from services.email_delivery_service import EmailDeliveryException, EmailDeliveryService

logger = logging.getLogger("souki.password_reset")

PASSWORD_RESET_EXPIRATION_MINUTES = 15
PASSWORD_RESET_PURPOSE = "password_reset"
GENERIC_PASSWORD_RESET_MESSAGE = (
    "Si un compte correspond à cette adresse, un lien de réinitialisation a été envoyé."
)


class PasswordResetService:
    @staticmethod
    def _password_version(password_hash: str | None) -> str:
        return hashlib.sha256((password_hash or "no-local-password").encode("utf-8")).hexdigest()

    @classmethod
    def _create_token(cls, user: User) -> str:
        now = datetime.now(timezone.utc)
        return jwt.encode(
            {
                "sub": str(user.id),
                "purpose": PASSWORD_RESET_PURPOSE,
                "pwdv": cls._password_version(user.password),
                "iat": now,
                "exp": now + timedelta(minutes=PASSWORD_RESET_EXPIRATION_MINUTES),
            },
            SECRET_KEY,
            algorithm=ALGORITHM,
        )

    @staticmethod
    def _decode_token(token: str) -> dict:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError as exc:
            raise HTTPException(
                status_code=400,
                detail="Le lien de réinitialisation est invalide ou expiré.",
            ) from exc

        if payload.get("purpose") != PASSWORD_RESET_PURPOSE:
            raise HTTPException(
                status_code=400,
                detail="Le lien de réinitialisation est invalide ou expiré.",
            )
        return payload

    def request_reset(self, email: str) -> dict:
        normalized_email = email.strip().casefold()
        db = LocalSession()
        try:
            user = (
                db.query(User)
                .filter(
                    func.lower(User.email) == normalized_email,
                    User.is_active.is_(True),
                    User.is_email_verified.is_(True),
                )
                .first()
            )
            if user:
                token = self._create_token(user)
                try:
                    EmailDeliveryService().send_password_reset_email(user.email, token)
                except EmailDeliveryException as exc:
                    # La réponse reste identique pour ne pas révéler l'existence du compte.
                    logger.error(
                        "[PASSWORD_RESET] Echec d'envoi pour user_id=%s (%s)",
                        user.id,
                        type(exc).__name__,
                    )
        finally:
            db.close()

        return {"message": GENERIC_PASSWORD_RESET_MESSAGE}

    def reset_password(self, token: str, new_password: str) -> dict:
        payload = self._decode_token(token)
        try:
            user_id = int(payload.get("sub"))
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=400,
                detail="Le lien de réinitialisation est invalide ou expiré.",
            ) from exc

        db = LocalSession()
        try:
            user = (
                db.query(User)
                .filter(User.id == user_id, User.is_active.is_(True))
                .with_for_update()
                .first()
            )
            expected_version = self._password_version(user.password) if user else ""
            supplied_version = str(payload.get("pwdv") or "")
            if not user or not hmac.compare_digest(expected_version, supplied_version):
                raise HTTPException(
                    status_code=400,
                    detail="Le lien de réinitialisation est invalide ou a déjà été utilisé.",
                )
            if user.password and verify_password(new_password, user.password):
                raise HTTPException(
                    status_code=400,
                    detail="Choisissez un mot de passe différent de l'ancien.",
                )

            user.password = hash_password(new_password)
            providers = {
                value.strip().casefold()
                for value in (user.auth_provider or "").split(",")
                if value.strip()
            }
            providers.add("local")
            user.auth_provider = ",".join(sorted(providers))
            db.query(UserSession).filter(
                UserSession.user_id == user.id,
                UserSession.is_active.is_(True),
            ).update({UserSession.is_active: False}, synchronize_session=False)
            db.commit()
            return {"message": "Votre mot de passe a été réinitialisé. Vous pouvez vous connecter."}
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
