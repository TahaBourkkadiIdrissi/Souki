from sqlalchemy import Column, Float, ForeignKey, Integer
from sqlalchemy.orm import relationship

from config import Base


class Wallet(Base):
    __tablename__ = "t_wallets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("t_users.id"))
    solde = Column(Float, default=0)

    user = relationship("User", back_populates="wallet")
    transactions = relationship("TransactionWallet", back_populates="wallet")
