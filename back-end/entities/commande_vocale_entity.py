from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from config import Base


class CommandeVocale(Base):
    __tablename__ = 'T_CommandeVocale'

    id                  = Column(Integer, primary_key=True, index=True)
    transcription_brute = Column(Text,        nullable=True)
    json_gemini_brut    = Column(Text,        nullable=True)
    langue_detectee     = Column(String(50),  nullable=True)
    created_at          = Column(DateTime,    default=func.now())

    lignes = relationship("LigneCommandeVocale", back_populates="commande")


class LigneCommandeVocale(Base):
    __tablename__ = 'T_LigneCommandeVocale'

    id                  = Column(Integer, primary_key=True, index=True)
    commande_id         = Column(Integer, ForeignKey('T_CommandeVocale.id'))
    product_id          = Column(Integer, ForeignKey('T_Product.id'))
    quantite_demandee   = Column(Float,  nullable=False)
    quantite_effective  = Column(Float,  nullable=False)
    prix_unitaire       = Column(Float,  nullable=False)
    sous_total          = Column(Float,  nullable=False)
    message_ajustement  = Column(String(255), nullable=True)

    commande = relationship("CommandeVocale", back_populates="lignes")
    produit  = relationship("Product")
