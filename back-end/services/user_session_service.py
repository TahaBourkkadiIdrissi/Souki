import hashlib
from datetime import datetime

from fastapi import Request

from config import LocalSession
from entities.user_session_entity import UserSession


class UserSessionService:
    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def create_session(self, user_id: int, token: str, request: Request | None = None):
        db = LocalSession()
        try:
            user_agent = request.headers.get("user-agent", "") if request else ""
            ip = request.client.host if request and request.client else None
            device_name = "Appareil inconnu"
            browser = "Navigateur inconnu"
            if "iphone" in user_agent.lower():
                device_name = "iPhone"
            elif "android" in user_agent.lower():
                device_name = "Android"
            elif "windows" in user_agent.lower():
                device_name = "Windows"
            elif "mac" in user_agent.lower():
                device_name = "Mac"

            if "chrome" in user_agent.lower():
                browser = "Chrome"
            elif "firefox" in user_agent.lower():
                browser = "Firefox"
            elif "safari" in user_agent.lower():
                browser = "Safari"

            session = UserSession(
                user_id=user_id,
                token_hash=self._hash_token(token),
                device_name=device_name,
                browser=browser,
                location="Maroc",
                ip=ip,
                is_active=True,
                last_active=datetime.utcnow(),
            )
            db.add(session)
            db.commit()
            return session
        finally:
            db.close()

    def validate_token_session(self, token: str) -> UserSession | None:
        db = LocalSession()
        try:
            return (
                db.query(UserSession)
                .filter(UserSession.token_hash == self._hash_token(token), UserSession.is_active.is_(True))
                .first()
            )
        finally:
            db.close()

    def is_session_active(self, session_id: int) -> bool:
        """Verifie qu'une session (par id) est toujours active (non revoquee)."""
        db = LocalSession()
        try:
            session = (
                db.query(UserSession)
                .filter(UserSession.id == session_id, UserSession.is_active.is_(True))
                .first()
            )
            return session is not None
        finally:
            db.close()

    def invalidate_token_session(self, token: str) -> bool:
        """Desactive la session correspondant au token (deconnexion)."""
        db = LocalSession()
        try:
            session = (
                db.query(UserSession)
                .filter(UserSession.token_hash == self._hash_token(token), UserSession.is_active.is_(True))
                .first()
            )
            if not session:
                return False
            session.is_active = False
            db.commit()
            return True
        finally:
            db.close()
