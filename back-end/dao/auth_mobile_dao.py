from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from entities.user_entity import User
from entities.user_session_entity import UserSession
from interfaces.auth_mobile_dao_interface import IAuthMobileDao


class AuthMobileDaoBD(IAuthMobileDao):
    """Requetes de l'entree de l'app (B12) et du renouvellement de session. Flush seulement."""

    def find_user_by_email(self, session: Session, email: str) -> Optional[User]:
        return session.query(User).filter(func.lower(User.email) == email.strip().lower()).first()

    def find_active_session(self, session: Session, token_hash: str) -> Optional[UserSession]:
        return (
            session.query(UserSession)
            .filter(UserSession.token_hash == token_hash, UserSession.is_active.is_(True))
            .with_for_update()
            .first()
        )

    def find_user(self, session: Session, user_id: int) -> Optional[User]:
        return session.query(User).filter(User.id == user_id).first()

    def rotate_session_token(self, session: Session, record: UserSession, token_hash: str) -> None:
        # Meme session (meme appareil dans « Sécurité »), nouveau jeton : l'ancien ne sert plus.
        record.token_hash = token_hash
        record.last_active = datetime.utcnow()
        session.flush()
