from abc import ABC, abstractmethod
from sqlalchemy.orm import Session
from typing import Optional
from entities.user_entity import User


class IUserDao(ABC):

    @abstractmethod
    def find_by_identifier(self, db: Session, identifier: str) -> Optional[User]:
        """Cherche un utilisateur par email OU téléphone."""
        pass

    @abstractmethod
    def find_by_email(self, db: Session, email: str) -> Optional[User]:
        """Cherche un utilisateur par email uniquement."""
        pass

    @abstractmethod
    def read(self, db: Session, user_id: int) -> Optional[User]:
        """Retourne un utilisateur par son ID."""
        pass

    @abstractmethod
    def create(self, db: Session, user: User) -> Optional[User]:
        """Persiste un nouvel utilisateur. Retourne None si doublon."""
        pass
