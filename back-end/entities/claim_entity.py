from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import relationship

from config import Base


class Claim(Base):
    __tablename__ = "t_claims"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("t_users.id"), nullable=False, index=True)
    commande_id = Column(Integer, ForeignKey("t_commandes.id"), nullable=False, index=True)
    ligne_panier_id = Column(Integer, ForeignKey("t_lignes_panier.id"), nullable=False, index=True)
    reason = Column(String(50), nullable=False)
    quantity_claimed = Column(Numeric(12, 3), nullable=False)
    amount_refunded = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default="REFUNDED", server_default="REFUNDED")
    is_suspect = Column(Boolean, nullable=False, default=False, server_default="false", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    user = relationship("User")
    commande = relationship("Commande")
    ligne_panier = relationship("LignePanier")
