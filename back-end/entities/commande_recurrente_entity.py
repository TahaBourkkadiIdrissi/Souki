from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import relationship
from config import Base


class CommandeRecurrente(Base):
    __tablename__ = "t_commandes_recurrentes"
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("t_clients.user_id"), nullable=False, index=True)
    type = Column(String(20), nullable=False)
    panier_souki_id = Column(Integer, ForeignKey("t_paniers_souki.id", ondelete="SET NULL"), nullable=True)
    commande_origine_id = Column(Integer, ForeignKey("t_commandes.id", ondelete="SET NULL"), nullable=True)
    frequence = Column(String(30), nullable=False)
    prochaine_livraison = Column(Date, nullable=False)
    statut = Column(String(20), nullable=False, default="ACTIVE")
    pause_jusqu_au = Column(Date, nullable=True)
    mode_paiement = Column(String(50), nullable=False)
    creneau_livraison = Column(String(100), nullable=False, default="08:00")
    contact_phone = Column(String(30), nullable=False)
    delivery_address = Column(String(500), nullable=False)
    delivery_city = Column(String(100), nullable=False)
    delivery_instructions = Column(String(500), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=True)
    arretee_at = Column(DateTime, nullable=True)
    __table_args__ = (Index("ix_commandes_recurrentes_echeance", "statut", "prochaine_livraison"),)

    lignes = relationship("CommandeRecurrenteLigne", order_by="CommandeRecurrenteLigne.id", cascade="all, delete-orphan")
    client = relationship("Client")


class CommandeRecurrenteLigne(Base):
    __tablename__ = "t_commandes_recurrentes_lignes"
    id = Column(Integer, primary_key=True)
    recurrence_id = Column(Integer, ForeignKey("t_commandes_recurrentes.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("T_Product.id"), nullable=False, index=True)
    quantite = Column(Float, nullable=False)
    prix_reference = Column(Float, nullable=True)
    __table_args__ = (UniqueConstraint("recurrence_id", "product_id"),)

    produit = relationship("Product")


class CommandeRecurrenteLivraison(Base):
    __tablename__ = "t_commandes_recurrentes_livraisons"
    id = Column(Integer, primary_key=True)
    recurrence_id = Column(Integer, ForeignKey("t_commandes_recurrentes.id", ondelete="CASCADE"), nullable=False)
    date_livraison = Column(Date, nullable=False, index=True)
    statut = Column(String(20), nullable=False)
    commande_id = Column(Integer, ForeignKey("t_commandes.id"), nullable=True, unique=True)
    montant = Column(Float, nullable=True)
    motif = Column(String(300), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    __table_args__ = (UniqueConstraint("recurrence_id", "date_livraison"),)
