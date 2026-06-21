from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from config import Base


class ZoneJIT(Base):
    __tablename__ = "t_zones_jit"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    nom_ville      = Column(String(100), nullable=False)
    lat_centre     = Column(Float(53), nullable=False)
    lng_centre     = Column(Float(53), nullable=False)
    rayon_km       = Column(Float(53), nullable=False, default=25.0)
    fournisseur_id = Column(Integer, ForeignKey("t_fournisseurs.user_id"), nullable=True)
    actif          = Column(Boolean, nullable=False, default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    fournisseur = relationship("Fournisseur", foreign_keys=[fournisseur_id])
