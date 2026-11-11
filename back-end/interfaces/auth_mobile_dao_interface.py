from abc import ABC, abstractmethod
from typing import Optional

from sqlalchemy.orm import Session

from entities.user_entity import User
from entities.user_session_entity import UserSession


class IAuthMobileDao(ABC):
    @abstractmethod
    def find_user_by_email(self, session: Session, email: str) -> Optional[User]:
        pass

    @abstractmethod
    def find_active_session(self, session: Session, token_hash: str) -> Optional[UserSession]:
        pass

    @abstractmethod
    def find_user(self, session: Session, user_id: int) -> Optional[User]:
        pass

    @abstractmethod
    def rotate_session_token(self, session: Session, record: UserSession, token_hash: str) -> None:
        pass
