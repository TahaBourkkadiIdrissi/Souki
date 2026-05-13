import random
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from config import GOOGLE_CLIENT_ID, LocalSession
from dao.user_dao import UserDao
from entities.client_entity import Client
from entities.client_blacklist_log_entity import ClientBlacklistLog
from entities.fournisseur_entity import Fournisseur
from entities.livreur_entity import Livreur
from entities.parent_entity import Parent
from entities.user_entity import User
from entities.verification_code_entity import VerificationCode
from rbac_config import LOGIN_TARGET_PERMISSIONS
from services.authorization_service import AuthorizationPrincipal, AuthorizationService
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
                    raise HTTPException(status_code=400, detail="Cet email est deja utilise.")
                if existing_email and not existing_email.is_verified:
                    raise HTTPException(
                        status_code=400,
                        detail="Un compte non verifie existe deja pour cet email. Utilisez le renvoi du code OTP."
                    )

            if data.phone:
                if self._is_phone_currently_blacklisted(db, data.phone):
                    raise HTTPException(status_code=400, detail="Ce numero n'est pas autorise.")

                existing_phone = _dao.find_by_identifier(db, data.phone)
                if existing_phone and existing_phone.is_verified:
                    raise HTTPException(status_code=400, detail="Ce numero de telephone est deja utilise.")
                if existing_phone and not existing_phone.is_verified:
                    raise HTTPException(
                        status_code=400,
                        detail="Un compte non verifie existe deja pour ce telephone. Utilisez le renvoi du code OTP."
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
                raise HTTPException(status_code=500, detail="Erreur interne lors de la creation du compte.")

            self._ensure_role_profile(db, user)
            self._ensure_rbac_role_assignment(db, user, role)
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
                "message": f"Un code OTP a ete envoye via {verification_channel}.",
            }
        finally:
            db.close()

    def login(self, data):
        db = LocalSession()
        try:
            target_role = (data.role or "CLIENT").upper()
            if target_role == "ADMIN":
                raise HTTPException(
                    status_code=403,
                    detail="Utilisez l'espace admin dedie pour vous connecter."
                )

            user = _dao.find_by_identifier(db, data.login_id)
            if user and not user.is_verified and not self._has_google_provider(user.auth_provider):
                raise HTTPException(
                    status_code=403,
                    detail="Compte non verifie. Veuillez confirmer le code OTP envoye avant de vous connecter."
                )

            if user and user.password and verify_password(data.password, user.password):
                principal = self._build_principal(db, user)
                self._assert_target_access(principal, target_role)
                self._ensure_profile_for_role(db, user, target_role)
                db.commit()
                return self._issue_access_token(user, principal, selected_role=target_role)

            return None
        finally:
            db.close()

    def admin_login(self, data):
        db = LocalSession()
        try:
            user = _dao.find_by_identifier(db, data.login_id)
            if user and not user.is_verified and not self._has_google_provider(user.auth_provider):
                raise HTTPException(
                    status_code=403,
                    detail="Compte non verifie. Veuillez confirmer le code OTP envoye avant de vous connecter."
                )

            if user and user.password and verify_password(data.password, user.password):
                principal = self._build_principal(db, user)
                if not principal.has_permission("admin.panel.access"):
                    raise HTTPException(status_code=403, detail="Acces admin refuse.")
                return self._issue_access_token(user, principal)

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
                raise HTTPException(status_code=404, detail="Aucun code OTP actif n'a ete trouve.")

            now = datetime.utcnow()
            if challenge.verified_at:
                raise HTTPException(status_code=400, detail="Ce code a deja ete utilise.")
            if challenge.expires_at < now:
                raise HTTPException(status_code=400, detail="Code expire. Demandez un nouveau code.")
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

            user.is_verified = bool(
                user.is_email_verified
                or user.is_phone_verified
                or self._has_google_provider(user.auth_provider)
            )
            self._ensure_rbac_role_assignment(db, user)
            db.commit()
            db.refresh(user)

            principal = self._build_principal(db, user)

            return {
                "message": "Verification reussie. Votre compte est maintenant actif.",
                "access_token": self._issue_access_token(user, principal),
                "token_type": "bearer",
                "is_verified": user.is_verified,
                "role": principal.primary_role,
                "roles": sorted(principal.roles),
                "permissions": sorted(principal.permissions),
                "default_dashboard": principal.default_dashboard,
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
                if (
                    existing_challenge.window_started_at <= now < window_ends_at
                    and existing_challenge.resend_count >= OTP_RESEND_LIMIT
                ):
                    retry_after = max(1, int((window_ends_at - now).total_seconds()))
                    raise HTTPException(
                        status_code=429,
                        detail=f"Trop d'envois. Reessayez dans {retry_after} secondes."
                    )

            otp_code = self._issue_otp(db, user, verification_channel, reset_rate_limit=False)
            self._send_otp(user, verification_channel, otp_code)

            challenge = self._get_active_challenge(db, user.id, verification_channel)
            resend_available_in = 60
            expires_in = max(1, int((challenge.expires_at - datetime.utcnow()).total_seconds()))

            return {
                "message": f"Un nouveau code OTP a ete envoye via {verification_channel}.",
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
                    initial_role = "CLIENT" if normalized_role == "FOURNISSEUR" else normalized_role
                    user = User(
                        email=email,
                        role=initial_role,
                        password=None,
                        is_verified=True,
                        is_email_verified=True,
                        is_phone_verified=False,
                        auth_provider="google",
                    )
                    db.add(user)
                    db.flush()
                    self._ensure_rbac_role_assignment(db, user, initial_role)
                else:
                    user.is_verified = True
                    user.is_email_verified = True
                    user.auth_provider = self._merge_auth_provider(user.auth_provider, "google")

                db.commit()
                db.refresh(user)

                principal = self._build_principal(db, user)
                self._assert_target_access(principal, normalized_role)
                self._ensure_profile_for_role(db, user, normalized_role)
                db.commit()
                return self._issue_access_token(user, principal, selected_role=normalized_role)
            finally:
                db.close()
        except ValueError:
            return None

    def get_by_id(self, user_id: int):
        db = LocalSession()
        try:
            user = _dao.read(db, user_id)
            if not user:
                return None
            principal = self._build_principal(db, user)
            return self._export_current_user(principal, db)
        finally:
            db.close()

    def _issue_otp(self, db, user: User, channel: str, reset_rate_limit: bool) -> str:
        now = datetime.utcnow()
        code = f"{random.randint(0, 999999):06d}"
        challenge = self._get_active_challenge(db, user.id, channel)

        if challenge:
            same_window = (
                challenge.window_started_at
                and now < challenge.window_started_at + timedelta(hours=OTP_RESEND_WINDOW_HOURS)
            )
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

    def _is_phone_currently_blacklisted(self, db, phone: str) -> bool:
        latest_log = (
            db.query(ClientBlacklistLog)
            .filter(ClientBlacklistLog.phone_snapshot == phone)
            .order_by(ClientBlacklistLog.created_at.desc(), ClientBlacklistLog.id.desc())
            .first()
        )
        return bool(latest_log and latest_log.action == "BLACKLISTED")

    def _resolve_channel(self, user: User) -> str:
        if user.email:
            return "email"
        if user.phone:
            return "phone"
        raise HTTPException(status_code=400, detail="Aucun moyen de contact a verifier.")

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

    def _ensure_client_profile(self, db, user: User):
        if user.client_profile:
            return
        db.add(Client(user_id=user.id))

    def _ensure_parent_profile(self, db, user: User):
        if user.parent_profile:
            return
        db.add(Parent(user_id=user.id))

    def _ensure_livreur_profile(self, db, user: User):
        if user.livreur_profile:
            return
        db.add(Livreur(user_id=user.id))

    def _ensure_profile_for_role(self, db, user: User, role_code: str):
        normalized_role = (role_code or user.role or "CLIENT").upper()
        if normalized_role == "CLIENT":
            self._ensure_client_profile(db, user)
            return
        if normalized_role == "PARENT":
            self._ensure_parent_profile(db, user)
            return
        if normalized_role == "LIVREUR":
            self._ensure_livreur_profile(db, user)

    def _ensure_role_profile(self, db, user: User):
        self._ensure_profile_for_role(db, user, user.role or "CLIENT")

    def _build_principal(self, db, user: User) -> AuthorizationPrincipal:
        return AuthorizationService(db).build_principal_from_user(user)

    def _ensure_rbac_role_assignment(self, db, user: User, role_code: Optional[str] = None):
        AuthorizationService(db).ensure_user_role(
            user_id=int(user.id),  # type: ignore[arg-type]
            role_code=(role_code or user.role or "CLIENT").upper(),
        )

    def _assert_target_access(self, principal: AuthorizationPrincipal, target_role: str):
        required_permission = LOGIN_TARGET_PERMISSIONS.get(target_role.upper())
        if not required_permission:
            raise HTTPException(status_code=400, detail="Espace de connexion invalide.")
        if principal.has_permission(required_permission):
            return

        profile_label = principal.primary_role or principal.legacy_role or "inconnu"
        raise HTTPException(
            status_code=403,
            detail=f"Acces refuse. Ce compte appartient au profil {profile_label}, vous ne pouvez pas vous connecter sur l'espace {target_role}."
        )

    def _issue_access_token(
        self,
        user: User,
        principal: AuthorizationPrincipal,
        selected_role: Optional[str] = None,
    ) -> str:
        token_role = selected_role if selected_role and principal.has_role(selected_role) else principal.primary_role
        return create_access_token(
            {
                "sub": str(user.id),
                "email": user.email,
                "role": token_role,
                "roles": sorted(principal.roles),
                "legacy_role": principal.legacy_role,
                "default_dashboard": principal.default_dashboard,
            }
        )

    def _export_current_user(self, principal: AuthorizationPrincipal, db=None) -> dict:
        profiles = self._load_profiles(db, principal.user_id) if db is not None else {}
        user_payload = {
            "id": principal.user_id,
            "email": principal.email,
            "phone": principal.phone,
            "name": principal.email or principal.phone,
        }
        return {
            "user": user_payload,
            "id": principal.user_id,
            "email": principal.email,
            "phone": principal.phone,
            "role": principal.primary_role,
            "legacy_role": principal.legacy_role,
            "roles": sorted(principal.roles),
            "permissions": sorted(principal.permissions),
            "is_verified": principal.is_verified,
            "is_active": principal.is_active,
            "default_dashboard": principal.default_dashboard,
            "profiles": profiles,
        }

    def export_current_principal(self, principal: AuthorizationPrincipal) -> dict:
        db = LocalSession()
        try:
            return self._export_current_user(principal, db)
        finally:
            db.close()

    def _load_profiles(self, db, user_id: int) -> dict:
        profiles = {}
        client = db.query(Client).filter(Client.user_id == user_id).first()
        if client:
            profiles["client"] = {
                "code_parrainage": client.code_parrainage,
                "is_blacklisted": bool(client.is_blacklisted),
            }

        livreur = db.query(Livreur).filter(Livreur.user_id == user_id).first()
        if livreur:
            profiles["livreur"] = {
                "vehicule": livreur.vehicule,
                "disponible": bool(livreur.disponible),
                "note_moyenne": livreur.note_moyenne,
            }

        parent = db.query(Parent).filter(Parent.user_id == user_id).first()
        if parent:
            profiles["parent"] = {"user_id": parent.user_id}

        fournisseur = db.query(Fournisseur).filter(Fournisseur.user_id == user_id).first()
        if fournisseur:
            profiles["fournisseur"] = {
                "shop_name": fournisseur.shop_name,
                "shop_slug": fournisseur.shop_slug,
                "statut": fournisseur.statut,
            }

        return profiles
