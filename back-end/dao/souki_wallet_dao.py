from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from entities.souki_wallet_entity import SoukiWallet
from entities.transaction_wallet_entity import TransactionWallet
from entities.user_entity import User
from interfaces.souki_wallet_dao_interface import ISoukiWalletDao


class SoukiWalletDaoBD(ISoukiWalletDao):

    def get_by_user_id(
        self,
        session: Session,
        user_id: int,
        *,
        for_update: bool = False,
    ) -> Optional[SoukiWallet]:
        statement = select(SoukiWallet).where(SoukiWallet.user_id == user_id)
        if for_update:
            statement = statement.with_for_update(of=SoukiWallet)
        return session.execute(statement).scalar_one_or_none()

    def lock_user(self, session: Session, user_id: int) -> Optional[User]:
        statement = select(User).where(User.id == user_id).with_for_update(of=User)
        return session.execute(statement).scalar_one_or_none()

    def create_wallet(
        self,
        session: Session,
        *,
        user_id: int,
        wallet_code: str,
        password_hash: str,
        balance: Decimal,
    ) -> SoukiWallet:
        wallet = SoukiWallet(
            user_id=user_id,
            wallet_code=wallet_code,
            password_hash=password_hash,
            balance=balance,
        )
        session.add(wallet)
        session.flush()
        return wallet

    def create_transaction(
        self,
        session: Session,
        *,
        wallet_id: object,
        transaction_type: str,
        amount: Decimal,
    ) -> TransactionWallet:
        transaction = TransactionWallet(
            wallet_id=wallet_id,
            type=transaction_type,
            montant=float(amount),
        )
        session.add(transaction)
        session.flush()
        return transaction
