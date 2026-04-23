from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from config import Base


class TransactionWallet(Base):
    __tablename__ = "t_transactions_wallet"

    id      = Column(Integer, primary_key=True, autoincrement=True)
    wallet_id = Column(Integer, ForeignKey("t_wallets.id"))
    type    = Column(String(20))
    libelle = Column(String(255), nullable=True)
    montant_centimes = Column(Integer, default=0)
    date    = Column(DateTime, server_default=func.now())

    wallet = relationship("Wallet", back_populates="transactions")
