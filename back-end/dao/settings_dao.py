from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from entities.address_entity import Address
from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.commande_recurrente_entity import CommandeRecurrente
from entities.push_subscription_entity import PushSubscription
from entities.user_favorite_entity import UserFavorite
from entities.verification_code_entity import VerificationCode
from entities.souki_wallet_entity import SoukiWallet
from entities.transaction_wallet_entity import TransactionWallet
from entities.user_entity import User
from entities.user_notification_preferences_entity import UserNotificationPreferences
from entities.user_session_entity import UserSession
from interfaces.settings_dao_interface import ISettingsDao


# Commande pas encore livree ni close (statuts de Documentation/regles.md et de order-status du site).
ORDER_IN_PROGRESS_STATUSES = (
    "EN_ATTENTE",
    "CONFIRMEE",
    "VERROUILLEE",
    "EN_ATTENTE_LIVREUR",
    "REFUS_LIVREUR",
    "A_LIVRER",
    "PLANIFIEE",
    "EN_ROUTE",
)


class SettingsDaoBD(ISettingsDao):
    """Requetes des parametres du compte, reprises telles quelles de SettingsService.

    Regle flush/commit : flush() apres chaque ecriture, jamais commit() ni rollback()
    (la transaction appartient au service).
    """

    def get_active_user(self, session: Session, user_id: int) -> Optional[User]:
        return session.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()

    def get_user(self, session: Session, user_id: int) -> Optional[User]:
        return session.query(User).filter(User.id == user_id).first()

    def find_other_user_by_email(self, session: Session, email: str, user_id: int) -> Optional[User]:
        return session.query(User).filter(User.email == email, User.id != user_id).first()

    def find_other_user_by_phone(self, session: Session, phone: str, user_id: int) -> Optional[User]:
        return session.query(User).filter(User.phone == phone, User.id != user_id).first()

    def get_preferred_address(self, session: Session, user_id: int) -> Optional[Address]:
        return (
            session.query(Address)
            .filter(Address.user_id == user_id)
            .order_by(Address.is_default.desc(), Address.id.desc())
            .first()
        )

    def create_address(self, session: Session, user_id: int, street: str, neighborhood: str) -> Address:
        address = Address(user_id=user_id, street=street, neighborhood=neighborhood)
        session.add(address)
        session.flush()
        return address

    def unset_other_default_addresses(self, session: Session, user_id: int, address_id: int) -> None:
        session.query(Address).filter(Address.user_id == user_id, Address.id != address_id).update(
            {Address.is_default: False},
            synchronize_session=False,
        )
        session.flush()

    def get_notification_preferences(self, session: Session, user_id: int) -> Optional[UserNotificationPreferences]:
        return session.query(UserNotificationPreferences).filter(UserNotificationPreferences.user_id == user_id).first()

    def create_notification_preferences(self, session: Session, user_id: int) -> UserNotificationPreferences:
        prefs = UserNotificationPreferences(user_id=user_id)
        session.add(prefs)
        session.flush()
        return prefs

    def list_active_sessions(self, session: Session, user_id: int) -> list[UserSession]:
        return (
            session.query(UserSession)
            .filter(UserSession.user_id == user_id, UserSession.is_active.is_(True))
            .order_by(UserSession.last_active.desc())
            .all()
        )

    def get_user_session(self, session: Session, session_id: int, user_id: int) -> Optional[UserSession]:
        return session.query(UserSession).filter(UserSession.id == session_id, UserSession.user_id == user_id).first()

    def deactivate_all_sessions(self, session: Session, user_id: int) -> None:
        session.query(UserSession).filter(UserSession.user_id == user_id, UserSession.is_active.is_(True)).update(
            {UserSession.is_active: False}, synchronize_session=False
        )
        session.flush()

    def get_wallet(self, session: Session, user_id: int) -> Optional[SoukiWallet]:
        return session.query(SoukiWallet).filter(SoukiWallet.user_id == user_id).first()

    def list_wallet_transactions(self, session: Session, wallet_id: int) -> list[TransactionWallet]:
        return (
            session.query(TransactionWallet)
            .filter(TransactionWallet.wallet_id == wallet_id)
            .order_by(TransactionWallet.date.desc())
            .all()
        )

    def create_wallet(self, session: Session, user_id: int, wallet_code: str, password_hash: str) -> SoukiWallet:
        wallet = SoukiWallet(
            user_id=user_id,
            wallet_code=wallet_code,
            password_hash=password_hash,
            balance=Decimal("0.00"),
        )
        session.add(wallet)
        # Leve IntegrityError si le code existe deja : le service reessaie avec un autre code.
        session.flush()
        return wallet

    def get_client(self, session: Session, user_id: int) -> Optional[Client]:
        return session.query(Client).filter(Client.user_id == user_id).first()

    # ---------- Suppression du compte (anonymisation) ----------

    def get_order_in_progress(self, session: Session, user_id: int) -> Optional[Commande]:
        return (
            session.query(Commande)
            .filter(Commande.client_id == user_id, Commande.statut.in_(ORDER_IN_PROGRESS_STATUSES))
            .order_by(Commande.id.desc())
            .first()
        )

    def anonymize_addresses(self, session: Session, user_id: int) -> None:
        # street et neighborhood sont NOT NULL : chaine vide, le reste a NULL.
        session.query(Address).filter(Address.user_id == user_id).update(
            {
                Address.street: "",
                Address.neighborhood: "",
                Address.details: None,
                Address.ville: None,
                Address.code_postal: None,
                Address.latitude: None,
                Address.longitude: None,
                Address.is_default: False,
            },
            synchronize_session=False,
        )
        session.flush()

    def stop_recurrences(self, session: Session, user_id: int) -> None:
        session.query(CommandeRecurrente).filter(CommandeRecurrente.client_id == user_id).update(
            {
                CommandeRecurrente.statut: "ARRETEE",
                CommandeRecurrente.contact_phone: "",
                CommandeRecurrente.delivery_address: "",
                CommandeRecurrente.delivery_instructions: None,
            },
            synchronize_session=False,
        )
        session.flush()

    def anonymize_sessions(self, session: Session, user_id: int) -> None:
        session.query(UserSession).filter(UserSession.user_id == user_id).update(
            {
                UserSession.is_active: False,
                UserSession.device_name: None,
                UserSession.browser: None,
                UserSession.location: None,
                UserSession.ip: None,
            },
            synchronize_session=False,
        )
        session.flush()

    def delete_push_subscriptions(self, session: Session, user_id: int) -> None:
        session.query(PushSubscription).filter(PushSubscription.user_id == user_id).delete(synchronize_session=False)
        session.flush()

    def delete_favorites(self, session: Session, user_id: int) -> None:
        session.query(UserFavorite).filter(UserFavorite.user_id == user_id).delete(synchronize_session=False)
        session.flush()

    def delete_verification_codes(self, session: Session, user_id: int) -> None:
        session.query(VerificationCode).filter(VerificationCode.user_id == user_id).delete(synchronize_session=False)
        session.flush()

    def save(self, session: Session) -> None:
        session.flush()
