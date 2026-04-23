import random
import string
from datetime import datetime

import bcrypt
from fastapi import HTTPException

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
    def get_profile(self, user_id: int):
        db = LocalSession()
        try:
            user = db.query(User).filter(User.id == user_id, User.is_deleted.is_(False)).first()
            if not user:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")

            address = user.settings_address
            return {
                "prenom": user.prenom or "",
                "nom": user.nom or "",
                "email": user.email or "",
                "telephone": user.phone or "",
                "photo_url": user.profile_image_url,
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
            user = db.query(User).filter(User.id == user_id, User.is_deleted.is_(False)).first()
            if not user:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")

            existing = db.query(User).filter(User.email == data.email, User.id != user_id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Cet email est deja utilise.")

            email_changed = (user.email or "").lower() != data.email.lower()
            user.prenom = data.prenom
            user.nom = data.nom
            user.email = data.email
            user.phone = data.telephone
            if email_changed:
                user.is_email_verified = False

            db.commit()
            return {"success": True, "email_changed": email_changed}
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
            user = db.query(User).filter(User.id == user_id, User.is_deleted.is_(False)).first()
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
            user.is_deleted = True
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
                wallet = Wallet(user_id=user_id, solde_centimes=0, is_activated=False)
                db.add(wallet)
                db.commit()
                db.refresh(wallet)

            txs = (
                db.query(TransactionWallet)
                .filter(TransactionWallet.wallet_id == wallet.id)
                .order_by(TransactionWallet.date.desc())
                .limit(5)
                .all()
            )
            identifier = wallet.wallet_identifier or "SKW-************"
            masked = f"{identifier[:4]}-********{identifier[-4:]}" if wallet.wallet_identifier else identifier
            return {
                "is_activated": wallet.is_activated,
                "solde_centimes": wallet.solde_centimes or 0,
                "wallet_identifier": masked,
                "transactions": [
                    {
                        "id": tx.id,
                        "type": tx.type,
                        "libelle": tx.libelle or "Transaction",
                        "montant_centimes": tx.montant_centimes,
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
                wallet = Wallet(user_id=user_id, solde_centimes=0)
                db.add(wallet)
            if wallet.is_activated:
                raise HTTPException(status_code=400, detail="Wallet deja active")

            rand = "".join(random.choices(string.ascii_uppercase + string.digits, k=12))
            wallet_identifier = f"SKW-{rand}"
            wallet.wallet_identifier = wallet_identifier
            wallet.wallet_password = bcrypt.hashpw(
                data.password.encode("utf-8"), bcrypt.gensalt(rounds=12)
            ).decode("utf-8")
            wallet.is_activated = True
            wallet.activated_at = datetime.utcnow()
            db.commit()
            return {"wallet_identifier": wallet_identifier}
        finally:
            db.close()
