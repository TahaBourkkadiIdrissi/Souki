import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from dal import UserDao, AddressDao
from entities import User, Address
from security import hash_password, verify_password, create_access_token
from config import LocalSession

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

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
            # Sécurité ajoutée: on vérifie que user.password n'est pas nul (cas des comptes Google)
            if user and user.password and verify_password(data.password, user.password): # type: ignore
                return create_access_token({"sub": str(user.id), "role": user.role})
            return None
        finally:
            db.close() # <-- Libère la connexion

    def google_login(self, token: str):
        try:
            # 1. Vérifier le token avec les serveurs de Google
            idinfo = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                GOOGLE_CLIENT_ID
            )
            email = idinfo.get('email')
            
            if not email:
                return None 

            db = LocalSession()
            try:
                # 2. Chercher si l'utilisateur existe déjà via son email avec le DAO
                user = UserDao.find_by_identifier(db, email)
                
                if not user:
                    # 3. Création automatique de l'utilisateur (sans mot de passe)
                    new_user = User(
                        email=email,
                        role="CLIENT",
                        password=None, # Pas de mot de passe car l'authentification est déléguée à Google
                        is_verified=True # Validé automatiquement car l'email vient de Google
                    )
                    user = UserDao.create(db, new_user)

                # 4. Générer le token JWT SOUKI
                access_token = create_access_token({"sub": str(user.id), "role": user.role}) # type: ignore
                return access_token
                
            finally:
                db.close()

        except ValueError:
            # Le Token est falsifié ou a expiré côté Google
            return None

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