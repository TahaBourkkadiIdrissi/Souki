from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from config import Base


class AnomalieLogistique(Base):
    __tablename__ = "t_anomalies_logistiques"
    __table_args__ = (
        CheckConstraint(
            "resolution IN ('REPLANIFIE', 'ANNULE_PERTE') OR resolution IS NULL",
            name="ck_t_anomalies_logistiques_resolution",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    commande_id = Column(Integer, ForeignKey("t_commandes.id"), nullable=False, index=True)
    type_anomalie = Column(String(100), nullable=False)
    detected_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Integer, ForeignKey("t_users.id"), nullable=True)
    resolution = Column(String(50), nullable=True)

    commande = relationship("Commande", back_populates="anomalies")
    resolved_by_user = relationship("User")
