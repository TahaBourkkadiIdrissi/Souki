from sqlalchemy import (Boolean, Column, DateTime, Float, ForeignKey, Integer,
                        UniqueConstraint, func)
from sqlalchemy.orm import relationship

from config import Base


class FournisseurProduit(Base):
    __tablename__ = "t_fournisseur_produits"
    __table_args__ = (
        UniqueConstraint("fournisseur_id", "produit_id", name="uq_fournisseur_produit"),
    )

    id             = Column(Integer, primary_key=True, autoincrement=True)
    fournisseur_id = Column(Integer, ForeignKey("t_fournisseurs.user_id"), nullable=False, index=True)
    produit_id     = Column(Integer, ForeignKey("T_Product.id"), nullable=False, index=True)
    prix_gros      = Column(Float, nullable=True)
    stock          = Column(Float, default=0.0)
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    fournisseur = relationship("Fournisseur", back_populates="offres")
    produit     = relationship("Product", back_populates="offres_fournisseurs")
