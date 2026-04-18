from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.orm import relationship
from config import Base


class Product(Base):
    __tablename__ = 'T_Product'

    id         = Column(Integer, primary_key=True, index=True)
    nom_fr     = Column(String(100), nullable=False)
    nom_darija = Column(String(100), nullable=False, unique=True)
    prix_kg    = Column(Float,       nullable=False)
    unite      = Column(String(50),  nullable=False)
    stock      = Column(Float,       nullable=False, default=0.0)

    lignes_commande_vocale = relationship("LigneCommandeVocale", back_populates="produit")
    lignes_panier          = relationship("LignePanier", back_populates="produit")
    produits_b2b           = relationship("ProduitB2B", back_populates="produit")
