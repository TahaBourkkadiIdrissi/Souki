# Mixin SQLAlchemy pour les colonnes pricing
# Ne jamais modifier product_entity.py
# Utiliser ce mixin uniquement dans les DAOs pricing

from sqlalchemy import Column, Float, Integer, String


class ProduitPricingMixin:
    marge_cible       = Column(Float,   default=0.25)
    coussin_securite  = Column(Float,   default=0.10)
    niveau            = Column(Integer, default=2)
    volatilite        = Column(String(20), default='STABLE')
    prix_gros_saisi   = Column(Float,   nullable=True)
    prix_affiche      = Column(Float,   nullable=True)
