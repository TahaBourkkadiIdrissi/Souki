from sqlalchemy.orm import Session
from typing import Optional
from interfaces.address_dao_interface import IAddressDao
from entities.address_entity import Address


class AddressDao(IAddressDao):

    def get_count(self, db: Session, user_id: int) -> int:
        return db.query(Address).filter(Address.user_id == user_id).count()

    def create(self, db: Session, addr: Address) -> Optional[Address]:
        try:
            db.add(addr)
            db.commit()
            db.refresh(addr)
            return addr
        except Exception:
            db.rollback()
            return None
