from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from config import Base


class Paiement(Base):
    __tablename__ = "t_paiements"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    commande_id = Column(Integer, ForeignKey("t_commandes.id"))
    methode     = Column(String(50))
    montant     = Column(Float)
    frais_cmi   = Column(Float)
    montant_net = Column(Float)
    valide      = Column(Boolean)

    commande = relationship("Commande", back_populates="paiement")
