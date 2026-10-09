from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from entities.commande_entity import Commande
from entities.souki_wallet_entity import SoukiWallet
from dto.order_edit_dto import OrderEditLineDTO


class IOrderEditDao(ABC):
    @abstractmethod
    def get_owned_order(self, session: Session, order_id: int, user_id: int, *, for_update: bool = False) -> Optional[Commande]:
        pass

    @abstractmethod
    def get_wallet_for_update(self, session: Session, user_id: int) -> Optional[SoukiWallet]:
        pass

    @abstractmethod
    def adjust_wallet(self, session: Session, wallet: SoukiWallet, difference: Decimal) -> None:
        pass

    @abstractmethod
    def save_order(self, session: Session, order: Commande, lines: list[OrderEditLineDTO], total: Decimal) -> None:
        pass
