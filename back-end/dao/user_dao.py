from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
from interfaces.user_dao_interface import IUserDao
from entities.user_entity import User


class UserDao(IUserDao):

    def find_by_identifier(self, db: Session, identifier: str) -> Optional[User]:
        return (
            db.query(User)
            .filter((User.email == identifier) | (User.phone == identifier))
            .first()
        )

    def find_by_email(self, db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    def read(self, db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    def create(self, db: Session, user: User) -> Optional[User]:
        try:
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        except IntegrityError:
            db.rollback()
            return None
