from dal import UserDao, AddressDao
from entities import User, Address
from security import hash_password, verify_password, create_access_token
from config import LocalSession

class AuthService:
    def register(self, data):
        db = LocalSession()
        try:
            # Sécurité : On interdit de s'enregistrer comme ADMIN via l'API publique
            if data.role.upper() == "ADMIN":
                data.role = "CLIENT"
                
            new_user = User(
                email=data.email,
                phone=data.phone,
                password=hash_password(data.password),
                role=data.role.upper()
            )
            return UserDao.create(db, new_user)
        finally:
            db.close() # <-- Libère la connexion pour le prochain utilisateur

    def login(self, data):
        db = LocalSession()
        try:
            user = UserDao.find_by_identifier(db, data.login_id)
            if user and verify_password(data.password, user.password):
                return create_access_token({"sub": str(user.id), "role": user.role})
            return None
        finally:
            db.close() # <-- Libère la connexion

class ProfileService:
    def add_address(self, user_id: int, data):
        db = LocalSession()
        try:
            if AddressDao.get_count(db, user_id) >= 3:
                return None # Limite atteinte
            
            # Note : data.dict() est déprécié dans Pydantic V2, on utilise model_dump() si tu es sur une version récente
            address_data = data.dict() if hasattr(data, 'dict') else data.model_dump()
            
            new_addr = Address(user_id=user_id, **address_data)
            return AddressDao.create(db, new_addr)
        finally:
            db.close() # <-- Libère la connexion