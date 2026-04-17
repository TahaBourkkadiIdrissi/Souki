import os
from fastapi import HTTPException
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
            # 1. Vérification de l'unicité de l'Email
            if data.email:
                existing_email = _dao.find_by_email(db, data.email)
                if existing_email:
                    raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")

            # 2. Vérification de l'unicité du Téléphone
            if data.phone:
                existing_phone = _dao.find_by_identifier(db, data.phone)
                if existing_phone:
                    raise HTTPException(status_code=400, detail="Ce numéro de téléphone est déjà utilisé.")

            # 3. Sécurité sur le rôle
            if data.role.upper() == "ADMIN":
                data.role = "CLIENT"

            # 4. Création de l'utilisateur
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
            
            # --- NOUVELLE SÉCURITÉ : VÉRIFICATION DU RÔLE ---
            if user:
                # Si les rôles ne correspondent pas (ex: le front envoie 'CLIENT' mais le user est 'LIVREUR')
                if user.role.upper() != data.role.upper():
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Accès refusé. Ce compte appartient à un profil {user.role}, vous ne pouvez pas vous connecter sur l'espace {data.role}."
                    )

            # Vérification classique du mot de passe
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