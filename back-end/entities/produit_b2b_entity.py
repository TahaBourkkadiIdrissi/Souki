from sqlalchemy import Column, Float, ForeignKey, Integer
from sqlalchemy.orm import relationship
from config import Base


class ProduitB2B(Base):
    __tablename__ = "t_produits_b2b"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    produit_id       = Column(Integer, ForeignKey("T_Product.id"))
    quantite         = Column(Float)
    prix_liquidation = Column(Float)

    produit = relationship("Product", back_populates="produits_b2b")
