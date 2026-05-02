from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from entities.souki_wallet_entity import SoukiWallet
from entities.transaction_wallet_entity import TransactionWallet
from entities.user_entity import User


class ISoukiWalletDao(ABC):

    @abstractmethod
    def get_by_user_id(
        self,
        session: Session,
        user_id: int,
        *,
        for_update: bool = False,
    ) -> Optional[SoukiWallet]:
        pass

    @abstractmethod
    def lock_user(self, session: Session, user_id: int) -> Optional[User]:
        pass

    @abstractmethod
    def create_wallet(
        self,
        session: Session,
        *,
        user_id: int,
        wallet_code: str,
        password_hash: str,
        balance: Decimal,
    ) -> SoukiWallet:
        pass

    @abstractmethod
    def create_transaction(
        self,
        session: Session,
        *,
        wallet_id: object,
        transaction_type: str,
        amount: Decimal,
    ) -> TransactionWallet:
        pass
