from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from config import Base


class Address(Base):
    __tablename__ = 't_addresses'

    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey('t_users.id'))
    neighborhood = Column(String(100), nullable=False)  # ex: Narjiss, Ville Nouvelle
    street       = Column(String(200), nullable=False)
    details      = Column(String(100))                  # Etage / Appartement
    ville        = Column(String(100), nullable=True)
    code_postal  = Column(String(20), nullable=True)
    latitude     = Column(Float(53))
    longitude    = Column(Float(53))
    is_default   = Column(Boolean, default=False, nullable=False)
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="addresses")
