import bcrypt
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
from entities.transaction_wallet_entity import TransactionWallet
from entities.user_address_entity import UserAddress
from entities.user_entity import User
from entities.user_notification_preferences_entity import UserNotificationPreferences
from entities.user_session_entity import UserSession
from entities.wallet_entity import Wallet
from security import verify_password


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
    def _to_centimes(amount: float | None) -> int:
        return int(round((amount or 0) * 100))

    def get_profile(self, user_id: int):
        db = LocalSession()
        try:
            user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
            if not user:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")

            address = user.settings_address
            prenom, nom = self._derive_name_parts(user)
            return {
                "prenom": prenom,
                "nom": nom,
                "email": user.email or "",
                "telephone": user.phone or "",
                "photo_url": None,
                "email_verified": bool(user.is_email_verified),
                "address": {
                    "adresse": address.adresse if address else "",
                    "ville": address.ville if address else "",
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
            address = db.query(UserAddress).filter(UserAddress.user_id == user_id).first()
            if not address:
                address = UserAddress(user_id=user_id)
                db.add(address)

            address.adresse = data.adresse
            address.ville = data.ville
            address.code_postal = data.code_postal
            db.commit()
            return {"success": True}
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
            wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
            if not wallet:
                return {
                    "is_activated": False,
                    "solde_centimes": 0,
                    "wallet_identifier": self._mask_wallet_identifier(self._wallet_identifier(user_id, None)),
                    "transactions": [],
                }

            txs = (
                db.query(TransactionWallet)
                .filter(TransactionWallet.wallet_id == wallet.id)
                .order_by(TransactionWallet.date.desc())
                .limit(5)
                .all()
            )
            identifier = self._wallet_identifier(user_id, wallet.id)
            return {
                "is_activated": True,
                "solde_centimes": self._to_centimes(wallet.solde),
                "wallet_identifier": self._mask_wallet_identifier(identifier),
                "transactions": [
                    {
                        "id": tx.id,
                        "type": tx.type,
                        "libelle": (tx.type or "transaction").replace("_", " ").title(),
                        "montant_centimes": self._to_centimes(tx.montant),
                        "date": tx.date.isoformat() if tx.date else None,
                    }
                    for tx in txs
                ],
            }
        finally:
            db.close()

    def activate_wallet(self, user_id: int, data: WalletActivationDTO):
        if data.password != data.confirm_password:
            raise HTTPException(status_code=400, detail="Les mots de passe ne correspondent pas")
        db = LocalSession()
        try:
            wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
            if not wallet:
                wallet = Wallet(user_id=user_id, solde=0)
                db.add(wallet)
                db.flush()

            wallet_identifier = self._wallet_identifier(user_id, wallet.id)
            db.commit()
            return {"wallet_identifier": wallet_identifier}
        finally:
            db.close()
