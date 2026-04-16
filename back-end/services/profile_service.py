from dao import AddressDao
from entities import Address
from config import LocalSession
from dto import AddressDTO


class ProfileService:
    def add_address(self, user_id: int, data: AddressDTO):
        db = LocalSession()
        try:
            if AddressDao.get_count(db, user_id) >= 3:
                return None  # Limite atteinte

            address_data = data.dict() if hasattr(data, 'dict') else data.model_dump()

            new_addr = Address(user_id=user_id, **address_data)
            return AddressDao.create(db, new_addr)
        finally:
            db.close()
