from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from entities.souki_wallet_entity import SoukiWallet
from entities.transaction_wallet_entity import TransactionWallet


class ISoukiWalletService(ABC):

    @abstractmethod
    def __enter__(self):
        pass

    @abstractmethod
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    @abstractmethod
    def get_or_create_wallet(self, user_id: int, session: Optional[Session] = None) -> SoukiWallet:
        pass

    @abstractmethod
    def credit_wallet(
        self,
        session: Session,
        *,
        wallet: SoukiWallet,
        amount: Decimal,
        transaction_type: str,
    ) -> TransactionWallet:
        pass
