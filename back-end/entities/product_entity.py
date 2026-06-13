from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float
from sqlalchemy.orm import relationship
from config import Base


class Product(Base):
    __tablename__ = 'T_Product'

    id         = Column(Integer, primary_key=True, index=True)
    nom_fr     = Column(String(100), nullable=False)
    nom_darija = Column(String(100), nullable=False, unique=True)
    prix_kg    = Column(Float,       nullable=False)
    unite      = Column(String(50),  nullable=False)
    stock      = Column(Float,       nullable=False, default=0.0)
    is_active  = Column(Boolean,     default=True)
    image_url  = Column(String(500), nullable=True)

    # Colonnes pricing — ajoutées après migration Supabase Mai 2026
    marge_cible       = Column(Float,      default=0.25)
    coussin_securite  = Column(Float,      default=0.10)
    niveau            = Column(Integer,    default=2)
    volatilite        = Column(String(20), default='STABLE')
    prix_gros_saisi   = Column(Float,      nullable=True)
    prix_khddar_reel  = Column(Float,      nullable=True)
    prix_affiche      = Column(Float,      nullable=True)
    prix_vente_manuel = Column(Float,      nullable=True)
    fournisseur_id    = Column(Integer, ForeignKey("t_fournisseurs.user_id"), nullable=True, index=True)

    lignes_commande_vocale = relationship("LigneCommandeVocale", back_populates="produit")
    lignes_panier          = relationship("LignePanier", back_populates="produit")
    produits_b2b           = relationship("ProduitB2B", back_populates="produit")
    fournisseur            = relationship("Fournisseur", back_populates="products")
