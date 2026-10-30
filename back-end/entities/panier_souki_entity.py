from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import relationship
from config import Base


class PanierSouki(Base):
    __tablename__ = "t_paniers_souki"
    id = Column(Integer, primary_key=True)
    nom = Column(String(120), nullable=False)
    description = Column(String(1000), nullable=True)
    image_url = Column(String(500), nullable=True)
    actif = Column(Boolean, nullable=False, default=True)
    ordre = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=True)

    lignes = relationship("PanierSoukiLigne", order_by="PanierSoukiLigne.id", cascade="all, delete-orphan")


class PanierSoukiLigne(Base):
    __tablename__ = "t_paniers_souki_lignes"
    id = Column(Integer, primary_key=True)
    panier_id = Column(Integer, ForeignKey("t_paniers_souki.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("T_Product.id"), nullable=False, index=True)
    quantite = Column(Float, nullable=False)
    __table_args__ = (UniqueConstraint("panier_id", "product_id"),)

    produit = relationship("Product")
