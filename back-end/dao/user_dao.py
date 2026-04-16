from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from entities import User


class UserDao:
    @staticmethod
    def find_by_identifier(db: Session, identifier: str):
        return db.query(User).filter(
            (User.email == identifier) | (User.phone == identifier)
        ).first()

    @staticmethod
    def find_by_email(db: Session, email: str):
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def read(db: Session, user_id: int):
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def create(db: Session, user: User):
        try:
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        except IntegrityError:
            db.rollback()
            return None
