from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from config import Base


class Address(Base):
    __tablename__ = 't_addresses'

    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey('t_users.id'))
    neighborhood = Column(String(100), nullable=False)  # ex: Narjiss, Ville Nouvelle
    street       = Column(String(200), nullable=False)
    details      = Column(String(100))                  # Etage / Appartement
    latitude     = Column(Float(53))
    longitude    = Column(Float(53))

    owner = relationship("User", back_populates="addresses")
