from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from config import Base


class Commande(Base):
    __tablename__ = "t_commandes"

    id                 = Column(Integer, primary_key=True, autoincrement=True)
    client_id          = Column(Integer, ForeignKey("t_clients.user_id"))
    panier_id          = Column(Integer, ForeignKey("t_paniers.id"))
    livreur_id         = Column(Integer, ForeignKey("t_livreurs.user_id"))
    tournee_id         = Column(Integer, ForeignKey("t_tournees.id"), nullable=True, index=True)
    ordre_passage      = Column(Integer, nullable=True)
    brouillon_vocal_id = Column(Integer, ForeignKey("T_CommandeVocale.id"), nullable=True)
    statut             = Column(String(50))
    date_commande      = Column(DateTime, server_default=func.now())
    creneau_livraison  = Column(String(100))
    enroute_at         = Column(DateTime(timezone=True), nullable=True)
    delivered_at       = Column(DateTime(timezone=True), nullable=True)
    absent_at          = Column(DateTime(timezone=True), nullable=True)
    status_version     = Column(Integer, nullable=False, default=1, server_default="1")
    payment_validated  = Column(Boolean, nullable=True, default=False, server_default="false")
    client_history_deleted = Column(Boolean, nullable=False, default=False, server_default="false")
    mode_paiement      = Column(String(50))
    montant_total      = Column(Float)

    client          = relationship("Client", back_populates="commandes")
    panier          = relationship("Panier", back_populates="commande")
    livreur         = relationship("Livreur", back_populates="commandes")
    tournee         = relationship("Tournee", back_populates="commandes")
    paiement        = relationship("Paiement", back_populates="commande", uselist=False)
    delivery_events = relationship("DeliveryEvent", back_populates="commande")
