from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from config import Base


class Tournee(Base):
    __tablename__ = "t_tournees"

    id = Column(Integer, primary_key=True, autoincrement=True)
    livreur_id = Column(Integer, ForeignKey("t_livreurs.user_id"), nullable=False, index=True)
    fournisseur_id = Column(Integer, ForeignKey("t_fournisseurs.user_id"), nullable=True, index=True)
    date_tournee = Column(Date, nullable=False, index=True)
    statut = Column(String(50), nullable=False, default="PLANIFIEE", server_default="PLANIFIEE")
    distance_totale_km = Column(Float, nullable=True)
    pickup_lat = Column(Float, nullable=True)
    pickup_lng = Column(Float, nullable=True)
    ramasse_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    livreur = relationship("Livreur", back_populates="tournees")
    fournisseur = relationship("Fournisseur", foreign_keys=[fournisseur_id])
    commandes = relationship("Commande", back_populates="tournee", order_by="Commande.ordre_passage")
