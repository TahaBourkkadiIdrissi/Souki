from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from entities import User, Address

class UserDao:
    @staticmethod
    def find_by_identifier(db: Session, identifier: str):
        return db.query(User).filter((User.email == identifier) | (User.phone == identifier)).first()

    @staticmethod
    def find_by_email(db: Session, email: str):
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def create(db: Session, user: User):
        try:
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        except IntegrityError:
            db.rollback() # On annule la transaction qui a échoué (ex: email déjà existant)
            return None   # On renvoie None pour que le Controller sache qu'il y a une erreur

class AddressDao:
    @staticmethod
    def get_count(db: Session, user_id: int):
        return db.query(Address).filter(Address.user_id == user_id).count()

    @staticmethod
    def create(db: Session, addr: Address):
        try:
            db.add(addr)
            db.commit()
            db.refresh(addr)
            return addr
        except Exception:
            db.rollback()
            return None