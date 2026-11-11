import bcrypt
import logging
from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from dto.settings_dto import (
    AddressUpdateDTO,
    ChangePasswordDTO,
    NotificationPreferencesDTO,
    PersonalInfoUpdateDTO,
    WalletActivationDTO,
)
from entities.address_entity import Address
from entities.user_entity import User
from dao.parrainage_dao import ParrainageDaoBD
from interfaces.settings_dao_interface import ISettingsDao
from interfaces.settings_service_interface import ISettingsService
from services.parrainage_service import ParrainageService
from security import verify_password
from services.supabase_storage_service import avatar_storage_service

logger = logging.getLogger("souki.settings")

# Adresse technique d'un compte supprime. La base exige un e-mail OU un telephone
# (contrainte ck_t_users_identity_present) : on garde une adresse unique par compte,
# sur le domaine reserve « .invalid » (RFC 2606), ou aucun e-mail ne peut partir.
DELETED_EMAIL_DOMAIN = "supprime.invalid"


def deleted_account_email(user_id: int) -> str:
    return f"supprime-{int(user_id)}@{DELETED_EMAIL_DOMAIN}"


class SettingsService(ISettingsService):
    """Parametres du compte. La session vient du controller (get_settings_service) ;
    les requetes sont dans SettingsDaoBD ; commit() a la fin des ecritures et
    rollback() en cas d'erreur, ici uniquement (Documentation/regles.md, regle 3)."""

    def __init__(self, dao: ISettingsDao, session: Session):
        self.dao = dao
        self.session = session

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

    def _preferred_address(self, user_id: int) -> Address | None:
        return self.dao.get_preferred_address(self.session, user_id)

    @staticmethod
    def _apply_settings_address(address: Address, data: AddressUpdateDTO) -> None:
        address.street = data.adresse
        if not address.neighborhood or address.neighborhood == address.ville:
            address.neighborhood = data.ville
        address.ville = data.ville
        address.code_postal = data.code_postal
        address.is_default = True

    def get_profile(self, user_id: int):
        user = self.dao.get_active_user(self.session, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")

        address = self._preferred_address(user_id)
        if user.prenom is None and user.nom is None:
            prenom, nom = self._derive_name_parts(user)
        else:
            prenom, nom = user.prenom or "", user.nom or ""
        return {
            "prenom": prenom,
            "nom": nom,
            "email": user.email or "",
            "telephone": user.phone or "",
            # RISK-007 : la base stocke le chemin de l'objet, jamais une URL
            # publique. L'URL signee est regeneree a chaque lecture.
            "photo_url": avatar_storage_service.resolve_avatar_url(user.avatar_url),
            "avatar_url": avatar_storage_service.resolve_avatar_url(user.avatar_url),
            "email_verified": bool(user.is_email_verified),
            "address": {
                "adresse": address.street if address else "",
                "ville": (address.ville or address.neighborhood) if address else "",
                "code_postal": address.code_postal if address else "",
            },
        }

    def update_personal_info(self, user_id: int, data: PersonalInfoUpdateDTO):
        try:
            user = self.dao.get_active_user(self.session, user_id)
            if not user:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")

            if data.email:
                existing = self.dao.find_other_user_by_email(self.session, data.email, user_id)
                if existing:
                    raise HTTPException(status_code=400, detail="Cet email est deja utilise.")

            if data.telephone:
                existing_phone = self.dao.find_other_user_by_phone(self.session, data.telephone, user_id)
                if existing_phone:
                    raise HTTPException(status_code=400, detail="Ce numero de telephone est deja utilise.")

            email_changed = (user.email or "").lower() != data.email.lower()
            user.prenom = data.prenom
            user.nom = data.nom
            user.email = data.email
            user.phone = data.telephone
            if email_changed:
                user.is_email_verified = False
                user.is_verified = bool(user.is_phone_verified)

            self.dao.save(self.session)
            self.session.commit()
            return {"success": True, "email_changed": email_changed}
        except IntegrityError:
            self.session.rollback()
            raise HTTPException(status_code=400, detail="Informations deja utilisees.")
        except Exception:
            self.session.rollback()
            raise

    def update_address(self, user_id: int, data: AddressUpdateDTO):
        try:
            address = self._preferred_address(user_id)
            if not address:
                address = self.dao.create_address(self.session, user_id, data.adresse, data.ville)

            self.dao.unset_other_default_addresses(self.session, user_id, address.id)
            self._apply_settings_address(address, data)
            self.dao.save(self.session)
            self.session.commit()
            return {"success": True}
        except Exception:
            self.session.rollback()
            raise

    def upload_profile_photo(self, user_id: int, content: bytes, content_type: str):
        # upload_avatar renvoie le CHEMIN de l'objet (bucket prive) : c'est lui
        # qui est persiste. Le front recoit une URL signee a duree limitee.
        object_path = avatar_storage_service.upload_avatar(user_id, content, content_type)

        try:
            user = self.dao.get_active_user(self.session, user_id)
            if not user:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")

            user.avatar_url = object_path
            self.dao.save(self.session)
            self.session.commit()
            signed_url = avatar_storage_service.resolve_avatar_url(object_path)
            return {"photo_url": signed_url, "avatar_url": signed_url}
        except Exception:
            self.session.rollback()
            raise

    def get_notifications(self, user_id: int):
        prefs = self.dao.get_notification_preferences(self.session, user_id)
        if not prefs:
            # Premiere lecture : les preferences par defaut sont creees, comme avant.
            try:
                prefs = self.dao.create_notification_preferences(self.session, user_id)
                self.session.commit()
            except Exception:
                self.session.rollback()
                raise

        return {
            "email": prefs.email,
            "push": prefs.push,
            "sms": prefs.sms,
            "promotions": prefs.promotions,
            "orderUpdates": prefs.order_updates,
            "newsletter": prefs.newsletter,
            "livraison": prefs.livraison,
        }

    def update_notifications(self, user_id: int, data: NotificationPreferencesDTO):
        try:
            prefs = self.dao.get_notification_preferences(self.session, user_id)
            if not prefs:
                prefs = self.dao.create_notification_preferences(self.session, user_id)

            prefs.email = data.email
            prefs.push = data.push
            prefs.sms = data.sms
            prefs.promotions = data.promotions
            prefs.order_updates = data.orderUpdates
            prefs.newsletter = data.newsletter
            prefs.livraison = data.livraison
            self.dao.save(self.session)
            self.session.commit()
            return {"success": True}
        except Exception:
            self.session.rollback()
            raise

    def change_password(self, user_id: int, data: ChangePasswordDTO):
        if data.new_password != data.confirm_password:
            raise HTTPException(status_code=400, detail="Les mots de passe ne correspondent pas")
        try:
            user = self.dao.get_active_user(self.session, user_id)
            if not user or not user.password:
                raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
            if not verify_password(data.current_password, user.password):
                raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")

            hashed = bcrypt.hashpw(data.new_password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")
            user.password = hashed
            self.dao.save(self.session)
            self.session.commit()
            return {"success": True}
        except Exception:
            self.session.rollback()
            raise

    def get_sessions(self, user_id: int, current_session_id: int | None):
        sessions = self.dao.list_active_sessions(self.session, user_id)
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

    def disconnect_session(self, user_id: int, session_id: int):
        try:
            user_session = self.dao.get_user_session(self.session, session_id, user_id)
            if not user_session:
                raise HTTPException(status_code=404, detail="Session introuvable")
            user_session.is_active = False
            self.dao.save(self.session)
            self.session.commit()
            return {"success": True}
        except Exception:
            self.session.rollback()
            raise

    def disconnect_all_sessions(self, user_id: int):
        try:
            self.dao.deactivate_all_sessions(self.session, user_id)
            self.session.commit()
            return {"success": True}
        except Exception:
            self.session.rollback()
            raise

    def delete_account(self, user_id: int):
        """Suppression du compte demandee par le client (App Store 5.1.1(v), loi 09-08).

        Le compte est anonymise, pas efface : les commandes, le Wallet et les reclamations
        y restent rattaches pour la comptabilite, sans plus rien qui identifie la personne.
        - Bloquee tant qu'une commande est en cours : le livreur a besoin de l'adresse.
        - E-mail et telephone liberes : la personne peut recreer un compte. L'e-mail est
          remplace par une adresse technique (contrainte « e-mail ou telephone » de t_users).
        - Nom, mot de passe, photo, adresses, sessions (IP, appareil), abonnements,
          favoris, notifications push et codes OTP effaces ou arretes.
        - Conserve pour la lutte contre la fraude (interet legitime) : les copies du
          numero dans la liste noire et le parrainage (phone_snapshot).
        Le tout dans une seule transaction ; la photo est supprimee du stockage ensuite.
        """
        try:
            user = self.dao.get_user(self.session, user_id)
            if not user:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")

            in_progress = self.dao.get_order_in_progress(self.session, user_id)
            if in_progress is not None:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Votre commande N-{in_progress.id} est en cours. Annulez-la ou attendez "
                        "sa livraison, puis supprimez votre compte."
                    ),
                )

            had_photo = bool(user.avatar_url)
            user.email = deleted_account_email(user_id)
            user.phone = None
            user.prenom = None
            user.nom = None
            user.password = None
            user.avatar_url = None
            user.is_active = False
            user.is_verified = False
            user.is_email_verified = False
            user.is_phone_verified = False
            self.dao.save(self.session)

            client = self.dao.get_client(self.session, user_id)
            if client is not None:
                # Le code ne doit plus crediter un compte supprime.
                client.code_parrainage = None
                self.dao.save(self.session)

            self.dao.anonymize_addresses(self.session, user_id)
            self.dao.stop_recurrences(self.session, user_id)
            self.dao.anonymize_sessions(self.session, user_id)
            self.dao.delete_push_subscriptions(self.session, user_id)
            self.dao.delete_favorites(self.session, user_id)
            self.dao.delete_verification_codes(self.session, user_id)
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise

        if had_photo:
            try:
                avatar_storage_service.delete_user_avatars(user_id)
            except Exception as exc:  # le compte est deja anonymise : on journalise seulement
                logger.error("[ACCOUNT_DELETE] photos non supprimees pour user_id=%s (%s)", user_id, type(exc).__name__)
        return {"success": True}

    def get_wallet(self, user_id: int):
        wallet = self.dao.get_wallet(self.session, user_id)
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

        txs = self.dao.list_wallet_transactions(self.session, wallet.id)
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
            # Credit offert (parrainage) et argent rembourse (reclamations, annulations).
            "solde_offert_centimes": self._to_centimes(min(wallet.solde_offert or 0, wallet.balance or 0)),
            "solde_rembourse_centimes": self._to_centimes(max((wallet.balance or 0) - (wallet.solde_offert or 0), 0)),
            "wallet_code_masked": masked_wallet_code,
            "wallet_identifier": masked_wallet_code,
            "transactions": transactions,
            "transaction_placeholder": "Aucune transaction pour le moment.",
            "created_at": wallet.created_at.isoformat() if wallet.created_at else None,
        }

    def activate_wallet(self, user_id: int, data: WalletActivationDTO):
        if data.password != data.confirm_password:
            raise HTTPException(status_code=400, detail="Les mots de passe ne correspondent pas")

        existing_wallet = self.dao.get_wallet(self.session, user_id)
        if existing_wallet:
            raise HTTPException(status_code=400, detail="Vous avez deja un portefeuille Souki.")

        # Le code doit etre unique : jusqu'a 5 essais, chacun dans sa propre transaction.
        for _ in range(5):
            wallet_code = self._generate_wallet_code()
            password_hash = bcrypt.hashpw(
                data.password.encode("utf-8"),
                bcrypt.gensalt(rounds=12),
            ).decode("utf-8")
            try:
                self.dao.create_wallet(self.session, user_id, wallet_code, password_hash)
                self.session.commit()
                return {
                    "wallet_code": wallet_code,
                    "wallet_identifier": wallet_code,
                    "balance_centimes": 0,
                }
            except IntegrityError:
                self.session.rollback()
            except Exception:
                self.session.rollback()
                raise

        raise HTTPException(
            status_code=500,
            detail="Impossible de generer un code portefeuille unique pour le moment.",
        )

    def generate_parrainage_code(self, user_id: int):
        try:
            client = self.dao.get_client(self.session, user_id)
            if not client:
                raise HTTPException(status_code=404, detail="Profil client introuvable")

            if client.code_parrainage:
                return {"code_parrainage": client.code_parrainage}

            parrainage_dao = ParrainageDaoBD()
            parrainage_service = ParrainageService(parrainage_dao=parrainage_dao)
            new_code = parrainage_service.generate_unique_code(self.session)

            client.code_parrainage = new_code
            self.dao.save(self.session)
            self.session.commit()
            return {"code_parrainage": new_code}
        except Exception:
            self.session.rollback()
            raise
