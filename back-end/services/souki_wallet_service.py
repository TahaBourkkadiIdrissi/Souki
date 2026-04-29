import bcrypt
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from config import LocalSession
from entities.souki_wallet_entity import SoukiWallet
from entities.transaction_wallet_entity import TransactionWallet
from interfaces.souki_wallet_dao_interface import ISoukiWalletDao
from interfaces.souki_wallet_service_interface import ISoukiWalletService


class SoukiWalletService(ISoukiWalletService):
    """Service metier du wallet Souki, avec DAO injecte comme le reste du backend."""

    def __init__(self, souki_wallet_dao: ISoukiWalletDao, session: Optional[Session] = None) -> None:
        self.souki_wallet_dao = souki_wallet_dao
        self.session = session
        self._owns_session = False

    def _ensure_session(self) -> Session:
        if self.session is None:
            self.session = LocalSession()
            self._owns_session = True
        return self.session

    def _close_owned_session(self, rollback: bool = False) -> None:
        if self.session and self._owns_session:
            if rollback:
                self.session.rollback()
            self.session.close()
            self.session = None
            self._owns_session = False

    def __enter__(self):
        self._ensure_session()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.session and self._owns_session:
            if exc_type is not None:
                self.session.rollback()
            else:
                self.session.commit()
            self.session.close()
            self.session = None
            self._owns_session = False

    @staticmethod
    def generate_wallet_code() -> str:
        return f"SOUKI-{uuid4().hex[:26].upper()}"

    @staticmethod
    def _generate_system_password_hash() -> str:
        random_password = uuid4().hex
        return bcrypt.hashpw(random_password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

    def get_or_create_wallet(self, user_id: int, session: Optional[Session] = None) -> SoukiWallet:
        auto_session = session is None and self.session is None
        active_session = session or self._ensure_session()

        try:
            user = self.souki_wallet_dao.lock_user(active_session, user_id)
            if user is None:
                raise ValueError("Utilisateur introuvable")

            wallet = self.souki_wallet_dao.get_by_user_id(active_session, user_id, for_update=True)
            if wallet is None:
                wallet = self.souki_wallet_dao.create_wallet(
                    active_session,
                    user_id=user_id,
                    wallet_code=self.generate_wallet_code(),
                    password_hash=self._generate_system_password_hash(),
                    balance=Decimal("0.00"),
                )

            if auto_session:
                active_session.commit()
                active_session.refresh(wallet)
                active_session.expunge(wallet)

            return wallet
        except Exception:
            if auto_session:
                active_session.rollback()
            raise
        finally:
            if auto_session:
                self._close_owned_session()

    def credit_wallet(
        self,
        session: Session,
        *,
        wallet: SoukiWallet,
        amount: Decimal,
        transaction_type: str,
    ) -> TransactionWallet:
        if amount <= Decimal("0.00"):
            raise ValueError("Le montant a crediter doit etre positif")

        wallet.balance = Decimal(str(wallet.balance or "0.00")) + amount
        return self.souki_wallet_dao.create_transaction(
            session,
            wallet_id=wallet.id,
            transaction_type=transaction_type,
            amount=amount,
        )
