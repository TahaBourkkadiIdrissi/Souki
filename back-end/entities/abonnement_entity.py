from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from config import Base


class Abonnement(Base):
    __tablename__ = "t_abonnements"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    parent_id       = Column(Integer, ForeignKey("t_parents.user_id"))
    enfant_id       = Column(Integer, ForeignKey("t_clients.user_id"))
    poids_garanti   = Column(Float)
    frequence       = Column(String(50))
    montant_mensuel = Column(Float)
    actif           = Column(Boolean)

    parent = relationship(
        "Parent",
        back_populates="abonnements",
        foreign_keys=[parent_id],
    )
    enfant = relationship(
        "Client",
        back_populates="abonnements_enfant",
        foreign_keys=[enfant_id],
    )
