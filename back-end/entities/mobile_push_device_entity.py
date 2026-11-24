from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from config import Base


class MobilePushDevice(Base):
    """Appareil mobile (app Android / iOS) abonne aux notifications push.

    Le jeton est un « Expo push token » (ExponentPushToken[...]) : le service
    Expo le relaie vers FCM (Android) ou APNs (iOS). Il identifie l'installation
    de l'app : il sert de cle naturelle, et passe au dernier compte connecte sur
    l'appareil.
    """

    __tablename__ = "t_mobile_push_devices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("t_users.id"), nullable=False, index=True)
    token = Column(String(255), nullable=False, unique=True)
    # "android" ou "ios".
    platform = Column(String(16), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    # Renseigne a la deconnexion de l'app ou quand Expo repond DeviceNotRegistered
    # (app desinstallee) : la ligne reste pour l'audit.
    revoked_at = Column(DateTime(timezone=True), nullable=True, index=True)

    user = relationship("User", foreign_keys=[user_id])
