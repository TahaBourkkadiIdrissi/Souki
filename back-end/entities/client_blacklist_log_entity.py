from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func

from config import Base


class ClientBlacklistLog(Base):
    __tablename__ = "t_client_blacklist_logs"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    client_id      = Column(Integer, ForeignKey("t_clients.user_id"), nullable=False)
    phone_snapshot = Column(String(50), nullable=True)
    action         = Column(String(20), nullable=False)
    reason         = Column(String(100), nullable=True)
    source         = Column(String(20), nullable=True)
    commande_id    = Column(Integer, ForeignKey("t_commandes.id", ondelete="SET NULL"), nullable=True)
    livreur_id     = Column(Integer, ForeignKey("t_livreurs.user_id", ondelete="SET NULL"), nullable=True)
    admin_id       = Column(Integer, ForeignKey("t_users.id", ondelete="SET NULL"), nullable=True)
    created_at     = Column(DateTime, server_default=func.now())
