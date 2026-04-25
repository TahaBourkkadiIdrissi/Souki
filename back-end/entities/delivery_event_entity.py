import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from config import Base


class DeliveryEvent(Base):
    __tablename__ = "t_delivery_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    commande_id = Column(Integer, ForeignKey("t_commandes.id", ondelete="CASCADE"), nullable=False, index=True)
    livreur_id = Column(Integer, ForeignKey("t_livreurs.user_id", ondelete="CASCADE"), nullable=False, index=True)
    previous_status = Column(String(50), nullable=False)
    new_status = Column(String(50), nullable=False)
    client_event_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    device_timestamp = Column(DateTime(timezone=True), nullable=False)
    server_timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    commande = relationship("Commande", back_populates="delivery_events")
    livreur = relationship("Livreur", back_populates="delivery_events")
