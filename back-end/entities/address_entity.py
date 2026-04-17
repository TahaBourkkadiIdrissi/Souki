from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from config import Base


class Address(Base):
    __tablename__ = 't_addresses'

    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey('t_users.id'))
    neighborhood = Column(String(100), nullable=False)  # ex: Narjiss, Ville Nouvelle
    street       = Column(String(200), nullable=False)
    details      = Column(String(100))                  # Etage / Appartement

    owner = relationship("User", back_populates="addresses")
