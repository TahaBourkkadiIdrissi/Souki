from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from config import Base


class Client(Base):
    __tablename__ = "t_clients"

    user_id         = Column(Integer, ForeignKey("t_users.id"), primary_key=True)
    code_parrainage = Column(String(100))
    is_blacklisted  = Column(Boolean, default=False)

    user               = relationship("User", back_populates="client_profile")
    commandes          = relationship("Commande", back_populates="client")
    abonnements_enfant = relationship(
        "Abonnement",
        back_populates="enfant",
        foreign_keys="Abonnement.enfant_id",
    )
