from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from config import Base


class Livreur(Base):
    __tablename__ = "t_livreurs"

    user_id      = Column(Integer, ForeignKey("t_users.id"), primary_key=True)
    vehicule     = Column(String(100))
    disponible   = Column(Boolean, default=True)
    note_moyenne = Column(Float)

    user = relationship("User", back_populates="livreur_profile")
    commandes = relationship("Commande", back_populates="livreur")
    tournees = relationship("Tournee", back_populates="livreur")
    delivery_events = relationship("DeliveryEvent", back_populates="livreur")
