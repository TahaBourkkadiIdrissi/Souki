from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from config import Base


class CODConfirmationLog(Base):
    __tablename__ = "t_cod_confirmation_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    commande_id = Column(Integer, ForeignKey("t_commandes.id", ondelete="CASCADE"), nullable=False, index=True)
    admin_id = Column(Integer, ForeignKey("t_users.id", ondelete="SET NULL"), nullable=True, index=True)
    statut = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    commande = relationship("Commande")
    admin = relationship("User")
