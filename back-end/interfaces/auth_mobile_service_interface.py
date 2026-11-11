from abc import ABC, abstractmethod

from dto.auth_mobile_dto import CheckEmailResponse, RefreshSessionResponse


class IAuthMobileService(ABC):
    @abstractmethod
    def check_email(self, email: str) -> CheckEmailResponse:
        pass

    @abstractmethod
    def refresh_session(self, token: str) -> RefreshSessionResponse:
        pass
