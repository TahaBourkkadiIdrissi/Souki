from config import LocalSession
from entities.address_entity import Address
from dao.address_dao import AddressDao

_dao = AddressDao()


class ProfileService:

    def add_address(self, user_id: int, data):
        db = LocalSession()
        try:
            existing_count = _dao.get_count(db, user_id)
            if existing_count >= 3:
                return None  # Limite de 3 adresses atteinte

            address_data = (
                data.dict() if hasattr(data, 'dict') else data.model_dump()
            )
            address_data["is_default"] = existing_count == 0
            new_addr = Address(user_id=user_id, **address_data)
            return _dao.create(db, new_addr)
        finally:
            db.close()
