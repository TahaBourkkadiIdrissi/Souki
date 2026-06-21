from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, func

from config import Base


# Statuts d'un parrainage. Le statut pilote l'idempotence de la conversion :
# un parrainage ne peut etre credite qu'une fois (EN_ATTENTE -> CONVERTI).
PARRAINAGE_EN_ATTENTE = "EN_ATTENTE"
PARRAINAGE_CONVERTI = "CONVERTI"
PARRAINAGE_REJETE = "REJETE"


class Parrainage(Base):
    __tablename__ = "t_parrainages"

    id                     = Column(Integer, primary_key=True, autoincrement=True)
    parrain_id             = Column(Integer, ForeignKey("t_clients.user_id"), nullable=False, index=True)
    # filleul_id UNIQUE : un compte ne peut etre parraine qu'une seule fois.
    filleul_id             = Column(Integer, ForeignKey("t_clients.user_id"), nullable=False, unique=True, index=True)
    code_utilise           = Column(String(10), nullable=False)
    statut                 = Column(String(20), nullable=False, default=PARRAINAGE_EN_ATTENTE)
    credit_parrain         = Column(Float, nullable=True)
    credit_filleul         = Column(Float, nullable=True)
    ip_inscription         = Column(String(64), nullable=True)
    phone_filleul_snapshot = Column(String(50), nullable=True)
    created_at             = Column(DateTime, server_default=func.now())
    converted_at           = Column(DateTime, nullable=True)
