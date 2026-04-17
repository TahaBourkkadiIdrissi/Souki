from sqlalchemy import Column, Integer, String, Float
from config import Base


class Product(Base):
    __tablename__ = 'T_Product'

    id = Column(Integer, primary_key=True, index=True)
    nom_fr = Column(String(100), nullable=False)
    nom_darija = Column(String(100), nullable=False, unique=True)
    prix_kg = Column(Float, nullable=False)
    unite = Column(String(50), nullable=False)
    stock = Column(Float, nullable=False, default=0.0)

    class Config:
        from_attributes = True
