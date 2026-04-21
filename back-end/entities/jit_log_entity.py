from sqlalchemy import Column, DateTime, Float, Integer, String, func, Text
from config import Base


class JITLog(Base):
    __tablename__ = "t_jit_logs"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    date_execution      = Column(DateTime, server_default=func.now())
    volume_total        = Column(Float)  # Total en kg
    nombre_commandes    = Column(Integer, default=0)
    nombre_abonnements  = Column(Integer, default=0)
    statut              = Column(String(50))  # "succès", "aucune_commande", "erreur"
    details_volumes     = Column(Text, nullable=True)  # JSON avec {"produit_id": {...volume, quantité}}
    message_alerte      = Column(Text, nullable=True)  # Message d'alerte si nécessaire
