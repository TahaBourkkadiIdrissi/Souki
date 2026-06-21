import bcrypt
from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from config import LocalSession
from dto.settings_dto import (
    AddressUpdateDTO,
    ChangePasswordDTO,
    NotificationPreferencesDTO,
    PersonalInfoUpdateDTO,
    WalletActivationDTO,
)
from entities.address_entity import Address
from entities.souki_wallet_entity import SoukiWallet
from entities.transaction_wallet_entity import TransactionWallet
from entities.user_entity import User
from entities.user_notification_preferences_entity import UserNotificationPreferences
from entities.user_session_entity import UserSession
from entities.client_entity import Client
from dao.parrainage_dao import ParrainageDaoBD
from services.parrainage_service import ParrainageService
from security import verify_password
from services.supabase_storage_service import avatar_storage_service


class SettingsService:
    def get_settings_bootstrap(self, user_id: int, current_session_id: int | None):
        return {
            "profile": self.get_profile(user_id),
            "notifications": self.get_notifications(user_id),
            "sessions": self.get_sessions(user_id, current_session_id),
            "wallet": self.get_wallet(user_id),
        }

    @staticmethod
    def _derive_name_parts(user: User) -> tuple[str, str]:
        source = (user.email or user.phone or "").split("@", 1)[0].replace(".", " ").replace("_", " ").strip()
        if not source:
            return "", ""

        parts = [part for part in source.split() if part]
        if not parts:
            return "", ""
        if len(parts) == 1:
            return parts[0].title(), ""
        return parts[0].title(), " ".join(parts[1:]).title()

    @staticmethod
    def _wallet_identifier(user_id: int, wallet_id: int | None) -> str:
        return f"SKW-{user_id:06d}-{(wallet_id or 0):06d}"

    @staticmethod
    def _mask_wallet_identifier(identifier: str) -> str:
        if len(identifier) <= 8:
            return identifier
        return f"{identifier[:4]}-********{identifier[-4:]}"

    @staticmethod
    def _mask_wallet_code(wallet_code: str | None) -> str | None:
        if not wallet_code:
            return None
        if len(wallet_code) <= 10:
            return wallet_code
        return f"{wallet_code[:6]}-********-{wallet_code[-4:]}"

    @staticmethod
    def _to_centimes(amount: Decimal | float | int | None) -> int:
        if amount is None:
            return 0
        return int(round(float(amount) * 100))

    @staticmethod
    def _generate_wallet_code() -> str:
        return f"SOUKI-{uuid4().hex[:12].upper()}"

    @staticmethod
    def _preferred_address(db, user_id: int) -> Address | None:
        return (
            db.query(Address)
            .filter(Address.user_id == user_id)
            .order_by(Address.is_default.desc(), Address.id.desc())
            .first()
        )

    @staticmethod
    def _apply_settings_address(address: Address, data: AddressUpdateDTO) -> None:
        address.street = data.adresse
        if not address.neighborhood or address.neighborhood == address.ville:
            address.neighborhood = data.ville
        address.ville = data.ville
        address.code_postal = data.code_postal
        address.is_default = True

    def get_profile(self, user_id: int):
        db = LocalSession()
        try:
            user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
            if not user:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")

            address = self._preferred_address(db, user_id)
            prenom, nom = self._derive_name_parts(user)
            return {
                "prenom": prenom,
                "nom": nom,
                "email": user.email or "",
                "telephone": user.phone or "",
                "photo_url": user.avatar_url,
                "avatar_url": user.avatar_url,
                "email_verified": bool(user.is_email_verified),
                "address": {
                    "adresse": address.street if address else "",
                    "ville": (address.ville or address.neighborhood) if address else "",
                    "code_postal": address.code_postal if address else "",
                },
            }
        finally:
            db.close()

    def update_personal_info(self, user_id: int, data: PersonalInfoUpdateDTO):
        db = LocalSession()
        try:
            user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
            if not user:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")

            if data.email:
                existing = db.query(User).filter(User.email == data.email, User.id != user_id).first()
                if existing:
                    raise HTTPException(status_code=400, detail="Cet email est deja utilise.")

            if data.telephone:
                existing_phone = db.query(User).filter(User.phone == data.telephone, User.id != user_id).first()
                if existing_phone:
                    raise HTTPException(status_code=400, detail="Ce numero de telephone est deja utilise.")

            email_changed = (user.email or "").lower() != data.email.lower()
            user.email = data.email
            user.phone = data.telephone
            if email_changed:
                user.is_email_verified = False
                user.is_verified = bool(user.is_phone_verified)

            db.commit()
            return {"success": True, "email_changed": email_changed, "name_fields_supported": False}
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=400, detail="Informations deja utilisees.")
        finally:
            db.close()

    def update_address(self, user_id: int, data: AddressUpdateDTO):
        db = LocalSession()
        try:
            address = self._preferred_address(db, user_id)
            if not address:
                address = Address(
                    user_id=user_id,
                    street=data.adresse,
                    neighborhood=data.ville,
                )
                db.add(address)
                db.flush()

            db.query(Address).filter(Address.user_id == user_id, Address.id != address.id).update(
                {Address.is_default: False},
                synchronize_session=False,
            )
            self._apply_settings_address(address, data)
            db.commit()
            return {"success": True}
        finally:
            db.close()

    def upload_profile_photo(self, user_id: int, content: bytes, content_type: str):
        avatar_url = avatar_storage_service.upload_avatar(user_id, content, content_type)

        db = LocalSession()
        try:
            user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
            if not user:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")

            user.avatar_url = avatar_url
            db.commit()
            return {"photo_url": avatar_url, "avatar_url": avatar_url}
        finally:
            db.close()

    def get_notifications(self, user_id: int):
        db = LocalSession()
        try:
            prefs = db.query(UserNotificationPreferences).filter(UserNotificationPreferences.user_id == user_id).first()
            if not prefs:
                prefs = UserNotificationPreferences(user_id=user_id)
                db.add(prefs)
                db.commit()
                db.refresh(prefs)

            return {
                "email": prefs.email,
                "push": prefs.push,
                "sms": prefs.sms,
                "promotions": prefs.promotions,
                "orderUpdates": prefs.order_updates,
                "newsletter": prefs.newsletter,
                "livraison": prefs.livraison,
            }
        finally:
            db.close()

    def update_notifications(self, user_id: int, data: NotificationPreferencesDTO):
        db = LocalSession()
        try:
            prefs = db.query(UserNotificationPreferences).filter(UserNotificationPreferences.user_id == user_id).first()
            if not prefs:
                prefs = UserNotificationPreferences(user_id=user_id)
                db.add(prefs)

            prefs.email = data.email
            prefs.push = data.push
            prefs.sms = data.sms
            prefs.promotions = data.promotions
            prefs.order_updates = data.orderUpdates
            prefs.newsletter = data.newsletter
            prefs.livraison = data.livraison
            db.commit()
            return {"success": True}
        finally:
            db.close()

    def change_password(self, user_id: int, data: ChangePasswordDTO):
        if data.new_password != data.confirm_password:
            raise HTTPException(status_code=400, detail="Les mots de passe ne correspondent pas")
        db = LocalSession()
        try:
            user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
            if not user or not user.password:
                raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
            if not verify_password(data.current_password, user.password):
                raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")

            hashed = bcrypt.hashpw(data.new_password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")
            user.password = hashed
            db.commit()
            return {"success": True}
        finally:
            db.close()

    def get_sessions(self, user_id: int, current_session_id: int | None):
        db = LocalSession()
        try:
            sessions = (
                db.query(UserSession)
                .filter(UserSession.user_id == user_id, UserSession.is_active.is_(True))
                .order_by(UserSession.last_active.desc())
                .all()
            )
            return [
                {
                    "id": s.id,
                    "device_name": s.device_name,
                    "browser": s.browser,
                    "location": s.location,
                    "ip": s.ip,
                    "last_active": s.last_active.isoformat() if s.last_active else None,
                    "is_current": bool(current_session_id and s.id == current_session_id),
                }
                for s in sessions
            ]
        finally:
            db.close()

    def disconnect_session(self, user_id: int, session_id: int):
        db = LocalSession()
        try:
            session = db.query(UserSession).filter(UserSession.id == session_id, UserSession.user_id == user_id).first()
            if not session:
                raise HTTPException(status_code=404, detail="Session introuvable")
            session.is_active = False
            db.commit()
            return {"success": True}
        finally:
            db.close()

    def disconnect_all_sessions(self, user_id: int):
        db = LocalSession()
        try:
            db.query(UserSession).filter(UserSession.user_id == user_id, UserSession.is_active.is_(True)).update(
                {UserSession.is_active: False}, synchronize_session=False
            )
            db.commit()
            return {"success": True}
        finally:
            db.close()

    def delete_account(self, user_id: int):
        db = LocalSession()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")
            user.is_active = False
            db.query(UserSession).filter(UserSession.user_id == user_id, UserSession.is_active.is_(True)).update(
                {UserSession.is_active: False}, synchronize_session=False
            )
            db.commit()
            return {"success": True}
        finally:
            db.close()

    def get_wallet(self, user_id: int):
        db = LocalSession()
        try:
            wallet = db.query(SoukiWallet).filter(SoukiWallet.user_id == user_id).first()
            if not wallet:
                return {
                    "has_wallet": False,
                    "is_activated": False,
                    "balance_centimes": 0,
                    "solde_centimes": 0,
                    "wallet_code_masked": None,
                    "wallet_identifier": None,
                    "transactions": [],
                    "transaction_placeholder": "Aucune transaction pour le moment.",
                }
            masked_wallet_code = self._mask_wallet_code(wallet.wallet_code)
            
            txs = db.query(TransactionWallet).filter(TransactionWallet.wallet_id == wallet.id).order_by(TransactionWallet.date.desc()).all()
            transactions = [
                {
                    "id": t.id,
                    "type": t.type,
                    "montant_centimes": self._to_centimes(t.montant),
                    "date": t.date.isoformat() if t.date else None,
                }
                for t in txs
            ]

            return {
                "has_wallet": True,
                "is_activated": True,
                "balance_centimes": self._to_centimes(wallet.balance),
                "solde_centimes": self._to_centimes(wallet.balance),
                "wallet_code_masked": masked_wallet_code,
                "wallet_identifier": masked_wallet_code,
                "transactions": transactions,
                "transaction_placeholder": "Aucune transaction pour le moment.",
                "created_at": wallet.created_at.isoformat() if wallet.created_at else None,
            }
        finally:
            db.close()

    def activate_wallet(self, user_id: int, data: WalletActivationDTO):
        if data.password != data.confirm_password:
            raise HTTPException(status_code=400, detail="Les mots de passe ne correspondent pas")
        db = LocalSession()
        try:
            existing_wallet = db.query(SoukiWallet).filter(SoukiWallet.user_id == user_id).first()
            if existing_wallet:
                raise HTTPException(status_code=400, detail="Vous avez deja un portefeuille Souki.")

            created_wallet = None
            for _ in range(5):
                wallet_code = self._generate_wallet_code()
                password_hash = bcrypt.hashpw(
                    data.password.encode("utf-8"),
                    bcrypt.gensalt(rounds=12),
                ).decode("utf-8")
                created_wallet = SoukiWallet(
                    user_id=user_id,
                    wallet_code=wallet_code,
                    password_hash=password_hash,
                    balance=Decimal("0.00"),
                )
                db.add(created_wallet)
                try:
                    db.commit()
                    db.refresh(created_wallet)
                    return {
                        "wallet_code": wallet_code,
                        "wallet_identifier": wallet_code,
                        "balance_centimes": 0,
                    }
                except IntegrityError:
                    db.rollback()
                    created_wallet = None

            raise HTTPException(
                status_code=500,
                detail="Impossible de generer un code portefeuille unique pour le moment.",
            )
        finally:
            db.close()

    def generate_parrainage_code(self, user_id: int):
        db = LocalSession()
        try:
            client = db.query(Client).filter(Client.user_id == user_id).first()
            if not client:
                raise HTTPException(status_code=404, detail="Profil client introuvable")
            
            if client.code_parrainage:
                return {"code_parrainage": client.code_parrainage}
                
            parrainage_dao = ParrainageDaoBD()
            parrainage_service = ParrainageService(parrainage_dao=parrainage_dao)
            new_code = parrainage_service.generate_unique_code(db)
            
            client.code_parrainage = new_code
            db.commit()
            return {"code_parrainage": new_code}
        finally:
            db.close()
