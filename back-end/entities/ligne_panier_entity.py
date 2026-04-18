from sqlalchemy import Column, Float, ForeignKey, Integer
from sqlalchemy.orm import relationship
from config import Base


class LignePanier(Base):
    __tablename__ = "t_lignes_panier"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    panier_id   = Column(Integer, ForeignKey("t_paniers.id"))
    produit_id  = Column(Integer, ForeignKey("T_Product.id"))
    quantite_kg = Column(Float)
    sous_total  = Column(Float)

    panier  = relationship("Panier", back_populates="lignes")
    produit = relationship("Product", back_populates="lignes_panier")
