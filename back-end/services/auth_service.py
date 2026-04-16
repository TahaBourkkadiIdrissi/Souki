import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dao import UserDao
from entities import User
from security import hash_password, verify_password, create_access_token
from config import LocalSession
from dto import UserRegister

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")


class AuthService:
    def register(self, data: UserRegister):
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
            db.close()

    def login(self, data):
        db = LocalSession()
        try:
            user = UserDao.find_by_identifier(db, data.login_id)
            # Sécurité : on vérifie que user.password n'est pas nul (cas des comptes Google)
            if user and user.password and verify_password(data.password, user.password): # type: ignore
                return create_access_token({"sub": str(user.id), "role": user.role})
            return None
        finally:
            db.close()

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
                # 2. Chercher si l'utilisateur existe déjà via son email
                user = UserDao.find_by_identifier(db, email)

                if not user:
                    # 3. Création automatique de l'utilisateur (sans mot de passe)
                    new_user = User(
                        email=email,
                        role="CLIENT",
                        password=None,  # Pas de mot de passe
                        is_verified=True  # Validé automatiquement
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
