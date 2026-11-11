from abc import ABC, abstractmethod
from typing import Optional

from sqlalchemy.orm import Session

from entities.address_entity import Address
from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.souki_wallet_entity import SoukiWallet
from entities.transaction_wallet_entity import TransactionWallet
from entities.user_entity import User
from entities.user_notification_preferences_entity import UserNotificationPreferences
from entities.user_session_entity import UserSession


class ISettingsDao(ABC):
    """Acces base des parametres du compte (profil, adresse, notifications, sessions, wallet)."""

    @abstractmethod
    def get_active_user(self, session: Session, user_id: int) -> Optional[User]:
        pass

    @abstractmethod
    def get_user(self, session: Session, user_id: int) -> Optional[User]:
        pass

    @abstractmethod
    def find_other_user_by_email(self, session: Session, email: str, user_id: int) -> Optional[User]:
        pass

    @abstractmethod
    def find_other_user_by_phone(self, session: Session, phone: str, user_id: int) -> Optional[User]:
        pass

    @abstractmethod
    def get_preferred_address(self, session: Session, user_id: int) -> Optional[Address]:
        pass

    @abstractmethod
    def create_address(self, session: Session, user_id: int, street: str, neighborhood: str) -> Address:
        pass

    @abstractmethod
    def unset_other_default_addresses(self, session: Session, user_id: int, address_id: int) -> None:
        pass

    @abstractmethod
    def get_notification_preferences(self, session: Session, user_id: int) -> Optional[UserNotificationPreferences]:
        pass

    @abstractmethod
    def create_notification_preferences(self, session: Session, user_id: int) -> UserNotificationPreferences:
        pass

    @abstractmethod
    def list_active_sessions(self, session: Session, user_id: int) -> list[UserSession]:
        pass

    @abstractmethod
    def get_user_session(self, session: Session, session_id: int, user_id: int) -> Optional[UserSession]:
        pass

    @abstractmethod
    def deactivate_all_sessions(self, session: Session, user_id: int) -> None:
        pass

    @abstractmethod
    def get_wallet(self, session: Session, user_id: int) -> Optional[SoukiWallet]:
        pass

    @abstractmethod
    def list_wallet_transactions(self, session: Session, wallet_id: int) -> list[TransactionWallet]:
        pass

    @abstractmethod
    def create_wallet(self, session: Session, user_id: int, wallet_code: str, password_hash: str) -> SoukiWallet:
        pass

    @abstractmethod
    def get_client(self, session: Session, user_id: int) -> Optional[Client]:
        pass

    # ---------- Suppression du compte (anonymisation) ----------

    @abstractmethod
    def get_order_in_progress(self, session: Session, user_id: int) -> Optional[Commande]:
        """Commande pas encore livree ni close : le livreur a encore besoin de l'adresse."""
        pass

    @abstractmethod
    def anonymize_addresses(self, session: Session, user_id: int) -> None:
        pass

    @abstractmethod
    def stop_recurrences(self, session: Session, user_id: int) -> None:
        """Arrete les abonnements et efface leurs coordonnees de livraison."""
        pass

    @abstractmethod
    def anonymize_sessions(self, session: Session, user_id: int) -> None:
        """Desactive les sessions et efface appareil, navigateur, lieu et IP."""
        pass

    @abstractmethod
    def delete_push_subscriptions(self, session: Session, user_id: int) -> None:
        pass

    @abstractmethod
    def delete_favorites(self, session: Session, user_id: int) -> None:
        pass

    @abstractmethod
    def delete_verification_codes(self, session: Session, user_id: int) -> None:
        pass

    @abstractmethod
    def save(self, session: Session) -> None:
        """Ecrit les modifications des objets deja charges (flush, jamais commit)."""
        pass
