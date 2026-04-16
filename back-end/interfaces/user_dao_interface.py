from abc import ABC, abstractmethod
from sqlalchemy.orm import Session
from entities import User


class IUserDao(ABC):
    @abstractmethod
    def find_by_identifier(self, db: Session, identifier: str) -> User:
        """Trouve un utilisateur par email ou téléphone"""
        pass

    @abstractmethod
    def find_by_email(self, db: Session, email: str) -> User:
        """Trouve un utilisateur par email"""
        pass

    @abstractmethod
    def read(self, db: Session, user_id: int) -> User:
        """Récupère un utilisateur par ID"""
        pass

    @abstractmethod
    def create(self, db: Session, user: User) -> User:
        """Crée un nouvel utilisateur"""
        pass
