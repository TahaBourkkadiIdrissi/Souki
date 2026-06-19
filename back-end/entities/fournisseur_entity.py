from sqlalchemy import CheckConstraint, Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from config import Base


class Fournisseur(Base):
    __tablename__ = "t_fournisseurs"
    __table_args__ = (
        CheckConstraint(
            "statut IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')",
            name="ck_t_fournisseurs_statut",
        ),
    )

    user_id = Column(Integer, ForeignKey("t_users.id"), primary_key=True)
    shop_name = Column(String, nullable=False)
    shop_slug = Column(String, unique=True, index=True)
    description = Column(Text)
    phone = Column(String)
    address = Column(Text)
    ville = Column(String, index=True)
    code_postal = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    siret = Column(String)
    logo_url = Column(String)
    couverture_url = Column(String)
    horaires = Column(JSONB)
    rating = Column(Float, default=0)
    nb_avis = Column(Integer, default=0)
    statut = Column(String, nullable=False, default="PENDING", index=True)
    rejected_reason = Column(Text)
    validated_by = Column(Integer, ForeignKey("t_users.id"), nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id], back_populates="fournisseur_profile")
    products = relationship("Product", back_populates="fournisseur")
    offres = relationship("FournisseurProduit", back_populates="fournisseur")
