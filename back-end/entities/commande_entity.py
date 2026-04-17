from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from config import Base


class Commande(Base):
    __tablename__ = "t_commandes"

    id                 = Column(Integer, primary_key=True, autoincrement=True)
    client_id          = Column(Integer, ForeignKey("t_clients.user_id"))
    panier_id          = Column(Integer, ForeignKey("t_paniers.id"))
    livreur_id         = Column(Integer, ForeignKey("t_livreurs.user_id"))
    statut             = Column(String(50))
    date_commande      = Column(DateTime, server_default=func.now())
    creneau_livraison  = Column(String(100))
    mode_paiement      = Column(String(50))
    montant_total      = Column(Float)

    client   = relationship("Client", back_populates="commandes")
    panier   = relationship("Panier", back_populates="commande")
    livreur  = relationship("Livreur", back_populates="commandes")
    paiement = relationship("Paiement", back_populates="commande", uselist=False)
