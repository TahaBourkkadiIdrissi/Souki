from sqlalchemy import Column, Float, ForeignKey, Integer
from sqlalchemy.orm import relationship
from config import Base


class Panier(Base):
    __tablename__ = "t_paniers"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    user_id       = Column(Integer, ForeignKey("t_users.id"))
    total_legumes = Column(Float)
    total_facture = Column(Float)
    marge_brute   = Column(Float)

    user     = relationship("User", back_populates="paniers")
    lignes   = relationship("LignePanier", back_populates="panier")
    commande = relationship("Commande", back_populates="panier", uselist=False)
