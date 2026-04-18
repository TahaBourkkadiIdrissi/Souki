from sqlalchemy import Column, DateTime, Float, Integer, String, func
from config import Base


class JITLog(Base):
    __tablename__ = "t_jit_logs"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    date_execution = Column(DateTime, server_default=func.now())
    volume_total   = Column(Float)
    statut         = Column(String(50))
