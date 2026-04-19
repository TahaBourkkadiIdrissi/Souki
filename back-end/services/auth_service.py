import random
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from config import GOOGLE_CLIENT_ID, LocalSession
from dao.user_dao import UserDao
from entities.client_entity import Client
from entities.livreur_entity import Livreur
from entities.parent_entity import Parent
from entities.user_entity import User
from entities.verification_code_entity import VerificationCode
from entities.wallet_entity import Wallet
from services.email_delivery_service import EmailDeliveryService
from security import create_access_token, hash_password, verify_password

OTP_EXPIRATION_MINUTES = 15
OTP_RESEND_LIMIT = 3
OTP_RESEND_WINDOW_HOURS = 1
OTP_MAX_ATTEMPTS = 5

_dao = UserDao()
_email_service = EmailDeliveryService()


class AuthService:
    def register(self, data):
        db = LocalSession()
        try:
            if data.email:
                existing_email = _dao.find_by_email(db, data.email)
                if existing_email and existing_email.is_verified:
                    raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")
                if existing_email and not existing_email.is_verified:
                    raise HTTPException(
                        status_code=400,
                        detail="Un compte non vérifié existe déjà pour cet email. Utilisez le renvoi du code OTP."
                    )

            if data.phone:
                existing_phone = _dao.find_by_identifier(db, data.phone)
                if existing_phone and existing_phone.is_verified:
                    raise HTTPException(status_code=400, detail="Ce numéro de téléphone est déjà utilisé.")
                if existing_phone and not existing_phone.is_verified:
                    raise HTTPException(
                        status_code=400,
                        detail="Un compte non vérifié existe déjà pour ce téléphone. Utilisez le renvoi du code OTP."
                    )

            role = "CLIENT" if data.role.upper() == "ADMIN" else data.role.upper()
            verification_channel = "email" if data.email else "phone"

            new_user = User(
                email=data.email,
                phone=data.phone,
                password=hash_password(data.password),
                role=role,
                is_verified=False,
                is_email_verified=False,
                is_phone_verified=False,
                auth_provider="local",
            )
            user = _dao.create(db, new_user)
            if not user:
                raise HTTPException(status_code=500, detail="Erreur interne lors de la création du compte.")
            self._ensure_role_profile(db, user)
            db.commit()

            otp_code = self._issue_otp(db, user, verification_channel, reset_rate_limit=True)
            self._send_otp(user, verification_channel, otp_code)

            return {
                "id": user.id,
                "email": user.email,
                "phone": user.phone,
                "role": user.role,
                "is_verified": user.is_verified,
                "verification_required": True,
                "verification_channel": verification_channel,
                "verification_target": self._mask_target(user, verification_channel),
                "expires_in_seconds": OTP_EXPIRATION_MINUTES * 60,
                "resend_available_in_seconds": 60,
                "message": f"Un code OTP a été envoyé via {verification_channel}.",
            }
        finally:
            db.close()

    def login(self, data):
        db = LocalSession()
        try:
            user = _dao.find_by_identifier(db, data.login_id)
            if user and user.role.upper() != data.role.upper():
                raise HTTPException(
                    status_code=403,
                    detail=f"Accès refusé. Ce compte appartient à un profil {user.role}, vous ne pouvez pas vous connecter sur l'espace {data.role}."
                )

            if user and not user.is_verified and not self._has_google_provider(user.auth_provider):
                raise HTTPException(
                    status_code=403,
                    detail="Compte non vérifié. Veuillez confirmer le code OTP envoyé avant de vous connecter."
                )

            if user and user.password and verify_password(data.password, user.password):
                return create_access_token({"sub": str(user.id), "role": user.role})

            return None
        finally:
            db.close()

    def verify_otp(self, user_id: int, code: str, channel: Optional[str] = None):
        db = LocalSession()
        try:
            user = _dao.read(db, user_id)
            if not user:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

            verification_channel = channel or self._resolve_channel(user)
            challenge = self._get_active_challenge(db, user.id, verification_channel)
            if not challenge:
                raise HTTPException(status_code=404, detail="Aucun code OTP actif n'a été trouvé.")

            now = datetime.utcnow()
            if challenge.verified_at:
                raise HTTPException(status_code=400, detail="Ce code a déjà été utilisé.")
            if challenge.expires_at < now:
                raise HTTPException(status_code=400, detail="Code expiré. Demandez un nouveau code.")
            if challenge.attempt_count >= OTP_MAX_ATTEMPTS:
                raise HTTPException(status_code=429, detail="Trop de tentatives. Demandez un nouveau code.")

            if not verify_password(code, challenge.code_hash):
                challenge.attempt_count += 1
                db.commit()
                if challenge.attempt_count >= OTP_MAX_ATTEMPTS:
                    raise HTTPException(status_code=429, detail="Trop de tentatives. Demandez un nouveau code.")
                raise HTTPException(status_code=400, detail="Code OTP invalide.")

            challenge.verified_at = now
            if verification_channel == "email":
                user.is_email_verified = True
            else:
                user.is_phone_verified = True

            user.is_verified = bool(user.is_email_verified or user.is_phone_verified or self._has_google_provider(user.auth_provider))
            self._ensure_wallet(db, user)
            db.commit()
            db.refresh(user)

            return {
                "message": "Vérification réussie. Votre compte est maintenant actif.",
                "access_token": create_access_token({"sub": str(user.id), "role": user.role}),
                "token_type": "bearer",
                "is_verified": user.is_verified,
                "verification_channel": verification_channel,
                "verification_target": self._mask_target(user, verification_channel),
                "expires_in_seconds": None,
                "resend_available_in_seconds": None,
            }
        finally:
            db.close()

    def resend_otp(self, user_id: int, channel: Optional[str] = None):
        db = LocalSession()
        try:
            user = _dao.read(db, user_id)
            if not user:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

            verification_channel = channel or self._resolve_channel(user)
            contact_value = user.email if verification_channel == "email" else user.phone
            if not contact_value:
                raise HTTPException(status_code=400, detail="Aucun moyen de contact disponible pour cet utilisateur.")

            existing_challenge = self._get_active_challenge(db, user.id, verification_channel)
            now = datetime.utcnow()
            if existing_challenge:
                window_ends_at = existing_challenge.window_started_at + timedelta(hours=OTP_RESEND_WINDOW_HOURS)
                if existing_challenge.window_started_at <= now < window_ends_at and existing_challenge.resend_count >= OTP_RESEND_LIMIT:
                    retry_after = max(1, int((window_ends_at - now).total_seconds()))
                    raise HTTPException(
                        status_code=429,
                        detail=f"Trop d'envois. Réessayez dans {retry_after} secondes."
                    )

            otp_code = self._issue_otp(db, user, verification_channel, reset_rate_limit=False)
            self._send_otp(user, verification_channel, otp_code)

            challenge = self._get_active_challenge(db, user.id, verification_channel)
            resend_available_in = 60
            expires_in = max(1, int((challenge.expires_at - datetime.utcnow()).total_seconds()))

            return {
                "message": f"Un nouveau code OTP a été envoyé via {verification_channel}.",
                "is_verified": user.is_verified,
                "verification_channel": verification_channel,
                "verification_target": self._mask_target(user, verification_channel),
                "expires_in_seconds": expires_in,
                "resend_available_in_seconds": resend_available_in,
            }
        finally:
            db.close()

    def google_login(self, token: str, role: str = "CLIENT"):
        try:
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
            email = idinfo.get("email")
            if not email:
                return None

            normalized_role = (role or "CLIENT").upper()

            db = LocalSession()
            try:
                user = _dao.find_by_email(db, email)
                if not user:
                    user = User(
                        email=email,
                        role=normalized_role,
                        password=None,
                        is_verified=True,
                        is_email_verified=True,
                        is_phone_verified=False,
                        auth_provider="google",
                    )
                    db.add(user)
                    db.flush()
                else:
                    if user.role.upper() != normalized_role:
                        raise HTTPException(
                            status_code=403,
                            detail=f"Acces refuse. Ce compte appartient a un profil {user.role}, vous ne pouvez pas vous connecter sur l'espace {normalized_role}."
                        )
                    user.is_verified = True
                    user.is_email_verified = True
                    user.auth_provider = self._merge_auth_provider(user.auth_provider, "google")

                self._ensure_role_profile(db, user)
                self._ensure_wallet(db, user)
                db.commit()
                db.refresh(user)
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

    def _issue_otp(self, db, user: User, channel: str, reset_rate_limit: bool) -> str:
        now = datetime.utcnow()
        code = f"{random.randint(0, 999999):06d}"
        challenge = self._get_active_challenge(db, user.id, channel)

        if challenge:
            same_window = challenge.window_started_at and now < challenge.window_started_at + timedelta(hours=OTP_RESEND_WINDOW_HOURS)
            if reset_rate_limit or not same_window:
                challenge.resend_count = 1
                challenge.window_started_at = now
            else:
                challenge.resend_count += 1
            challenge.code_hash = hash_password(code)
            challenge.attempt_count = 0
            challenge.expires_at = now + timedelta(minutes=OTP_EXPIRATION_MINUTES)
            challenge.last_sent_at = now
            challenge.verified_at = None
        else:
            challenge = VerificationCode(
                user_id=user.id,
                channel=channel,
                code_hash=hash_password(code),
                attempt_count=0,
                resend_count=1,
                expires_at=now + timedelta(minutes=OTP_EXPIRATION_MINUTES),
                window_started_at=now,
                last_sent_at=now,
            )
            db.add(challenge)

        db.commit()
        return code

    def _get_active_challenge(self, db, user_id: int, channel: str):
        return (
            db.query(VerificationCode)
            .filter(VerificationCode.user_id == user_id, VerificationCode.channel == channel)
            .order_by(VerificationCode.created_at.desc(), VerificationCode.id.desc())
            .first()
        )

    def _resolve_channel(self, user: User) -> str:
        if user.email:
            return "email"
        if user.phone:
            return "phone"
        raise HTTPException(status_code=400, detail="Aucun moyen de contact à vérifier.")

    def _mask_target(self, user: User, channel: str) -> Optional[str]:
        value = user.email if channel == "email" else user.phone
        if not value:
            return None

        if channel == "email":
            local, _, domain = value.partition("@")
            if len(local) <= 2:
                masked_local = f"{local[0]}*" if local else "*"
            else:
                masked_local = f"{local[:2]}{'*' * max(1, len(local) - 2)}"
            return f"{masked_local}@{domain}"

        if len(value) <= 4:
            return "*" * len(value)
        return f"{value[:4]}{'*' * max(1, len(value) - 6)}{value[-2:]}"

    def _send_otp(self, user: User, channel: str, code: str):
        destination = user.email if channel == "email" else user.phone
        print("")
        print("=" * 64)
        print("SOUKI OTP DEBUG")
        print(f"Canal       : {channel}")
        print(f"Destination : {destination}")
        print(f"Code OTP    : {code}")
        print("=" * 64)
        print("")

        if channel == "email":
            try:
                _email_service.send_otp_email(destination, code)
                print(f"[SMTP] Email OTP envoye avec succes vers {destination}")
            except Exception as exc:
                print(f"[SMTP] Envoi email impossible: {exc}")
                print("[SMTP] Le code reste visible ci-dessus pour les tests locaux.")
            return

        print(f"[OTP:{channel}] Envoi reel non configure pour ce canal, utilisez le code affiche dans le terminal.")

    def _has_google_provider(self, provider: Optional[str]) -> bool:
        return bool(provider and "google" in provider.split(","))

    def _merge_auth_provider(self, current: Optional[str], incoming: str) -> str:
        providers = {part.strip() for part in (current or "local").split(",") if part.strip()}
        providers.add(incoming)
        return ",".join(sorted(providers))

    def _ensure_wallet(self, db, user: User):
        if not user.is_verified:
            return
        if user.wallet:
            return
        db.add(Wallet(user_id=user.id, solde=0))

    def _ensure_client_profile(self, db, user: User):
        if user.role != "CLIENT":
            return
        if user.client_profile:
            return
        db.add(Client(user_id=user.id))

    def _ensure_parent_profile(self, db, user: User):
        if user.role != "PARENT":
            return
        if user.parent_profile:
            return
        db.add(Parent(user_id=user.id))

    def _ensure_livreur_profile(self, db, user: User):
        if user.role != "LIVREUR":
            return
        if user.livreur_profile:
            return
        db.add(Livreur(user_id=user.id))

    def _ensure_role_profile(self, db, user: User):
        self._ensure_client_profile(db, user)
        self._ensure_parent_profile(db, user)
        self._ensure_livreur_profile(db, user)
