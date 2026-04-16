from sqlalchemy.orm import Session
from entities import Address


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
