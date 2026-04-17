import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from config import LocalSession
from entities.user_entity import User
from dao.user_dao import UserDao
from security import hash_password, verify_password, create_access_token

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
_dao = UserDao()


class AuthService:

    def register(self, data):
        db = LocalSession()
        try:
            if data.role.upper() == "ADMIN":
                data.role = "CLIENT"

            new_user = User(
                email=data.email,
                phone=data.phone,
                password=hash_password(data.password),
                role=data.role.upper()
            )
            return _dao.create(db, new_user)
        finally:
            db.close()

    def login(self, data):
        db = LocalSession()
        try:
            user = _dao.find_by_identifier(db, data.login_id)
            if user and user.password and verify_password(data.password, user.password):
                return create_access_token({"sub": str(user.id), "role": user.role})
            return None
        finally:
            db.close()

    def google_login(self, token: str):
        try:
            idinfo = id_token.verify_oauth2_token(
                token, google_requests.Request(), GOOGLE_CLIENT_ID
            )
            email = idinfo.get('email')
            if not email:
                return None

            db = LocalSession()
            try:
                user = _dao.find_by_identifier(db, email)
                if not user:
                    new_user = User(
                        email=email,
                        role="CLIENT",
                        password=None,
                        is_verified=True
                    )
                    user = _dao.create(db, new_user)
                return create_access_token({"sub": str(user.id), "role": user.role})
            finally:
                db.close()
        except ValueError:
            return None

    def get_by_id(self, user_id: int):
        db = LocalSession()
        try:
            return _dao.read(db, user_id)
        finally:
            db.close()
