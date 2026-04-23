from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from config import Base


class Wallet(Base):
    __tablename__ = "t_wallets"

    id      = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("t_users.id"))
    solde_centimes = Column(Integer, default=0)
    wallet_identifier = Column(String(20), nullable=True, unique=True)
    wallet_password = Column(String(255), nullable=True)
    is_activated = Column(Boolean, default=False)
    activated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user         = relationship("User", back_populates="wallet")
    transactions = relationship("TransactionWallet", back_populates="wallet")
