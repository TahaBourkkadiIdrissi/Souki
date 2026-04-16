from sqlalchemy import Column, Integer, String, DateTime, func, Boolean, ForeignKey,Text, func,Float
from sqlalchemy.orm import relationship
from config import Base

class User(Base):
    __tablename__ = 't_users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(128), unique=True, index=True, nullable=True)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    # MODIFICATION ICI : nullable=True pour autoriser l'inscription via Google
    password = Column(String(128), nullable=True) 
    role = Column(String(20), default="CLIENT") # CLIENT, PARENT, LIVREUR, ADMIN
    is_verified = Column(Boolean, default=False)
    
    # Relation Parent-Enfant
    parent_id = Column(Integer, ForeignKey('t_users.id'), nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    
    addresses = relationship("Address", back_populates="owner")

class Address(Base):
    __tablename__ = 't_addresses'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('t_users.id'))
    neighborhood = Column(String(100), nullable=False) # ex: Narjiss, Ville Nouvelle
    street = Column(String(200), nullable=False)
    details = Column(String(100)) # Etage/Appart
    
    owner = relationship("User", back_populates="addresses")

class Product(Base):
    __tablename__ = 'T_Product'

    id = Column(Integer, primary_key=True, index=True)
    nom_fr = Column(String(100), nullable=False)
    nom_darija = Column(String(100), nullable=False, unique=True)
    prix_kg = Column(Float, nullable=False)
    unite = Column(String(50), nullable=False)
    stock = Column(Float, nullable=False, default=0.0)


class CommandeVocale(Base):
    __tablename__ = 'T_CommandeVocale'

    id = Column(Integer, primary_key=True, index=True)
    transcription_brute = Column(Text, nullable=True)
    json_gemini_brut = Column(Text, nullable=True)
    langue_detectee = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=func.now())

    lignes = relationship("LigneCommandeVocale", back_populates="commande")

class LigneCommandeVocale(Base):
    __tablename__ = 'T_LigneCommandeVocale'

    id = Column(Integer, primary_key=True, index=True)
    commande_id = Column(Integer, ForeignKey('T_CommandeVocale.id'))
    product_id = Column(Integer, ForeignKey('T_Product.id'))
    quantite_demandee = Column(Float, nullable=False)
    quantite_effective = Column(Float, nullable=False)
    prix_unitaire = Column(Float, nullable=False)
    sous_total = Column(Float, nullable=False)
    message_ajustement = Column(String(255), nullable=True)

    commande = relationship("CommandeVocale", back_populates="lignes")
    produit = relationship("Product")