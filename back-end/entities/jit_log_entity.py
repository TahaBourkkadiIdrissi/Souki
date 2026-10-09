from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, func, Text
from config import Base


class JITLog(Base):
    __tablename__ = "t_jit_logs"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    date_execution      = Column(DateTime, server_default=func.now())
    date_livraison      = Column(Date, nullable=True, index=True)
    volume_total        = Column(Float)
    nombre_commandes    = Column(Integer, default=0)
    nombre_abonnements  = Column(Integer, default=0)
    statut              = Column(String(50))  # "succès", "aucune_commande", "erreur"
    details_volumes     = Column(Text, nullable=True)
    message_alerte      = Column(Text, nullable=True)
    zone_id             = Column(Integer, ForeignKey("t_zones_jit.id", ondelete="SET NULL"), nullable=True)
    nom_ville           = Column(String(100), nullable=True)
