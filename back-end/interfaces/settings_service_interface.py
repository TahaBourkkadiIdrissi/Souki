from abc import ABC, abstractmethod

from dto.settings_dto import (
    AddressUpdateDTO,
    ChangePasswordDTO,
    NotificationPreferencesDTO,
    PersonalInfoUpdateDTO,
    WalletActivationDTO,
)


class ISettingsService(ABC):
    """Parametres du compte client : profil, adresse, photo, notifications, securite, wallet."""

    @abstractmethod
    def get_settings_bootstrap(self, user_id: int, current_session_id: int | None):
        pass

    @abstractmethod
    def get_profile(self, user_id: int):
        pass

    @abstractmethod
    def update_personal_info(self, user_id: int, data: PersonalInfoUpdateDTO):
        pass

    @abstractmethod
    def update_address(self, user_id: int, data: AddressUpdateDTO):
        pass

    @abstractmethod
    def upload_profile_photo(self, user_id: int, content: bytes, content_type: str):
        pass

    @abstractmethod
    def get_notifications(self, user_id: int):
        pass

    @abstractmethod
    def update_notifications(self, user_id: int, data: NotificationPreferencesDTO):
        pass

    @abstractmethod
    def change_password(self, user_id: int, data: ChangePasswordDTO):
        pass

    @abstractmethod
    def get_sessions(self, user_id: int, current_session_id: int | None):
        pass

    @abstractmethod
    def disconnect_session(self, user_id: int, session_id: int):
        pass

    @abstractmethod
    def disconnect_all_sessions(self, user_id: int):
        pass

    @abstractmethod
    def delete_account(self, user_id: int):
        pass

    @abstractmethod
    def get_wallet(self, user_id: int):
        pass

    @abstractmethod
    def activate_wallet(self, user_id: int, data: WalletActivationDTO):
        pass

    @abstractmethod
    def generate_parrainage_code(self, user_id: int):
        pass
