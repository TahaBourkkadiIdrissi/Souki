from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from config import Base


class User(Base):
    __tablename__ = "t_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(128), unique=True, index=True, nullable=True)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    password = Column(String(128), nullable=True)
    role = Column(String(20), default="CLIENT")
    is_verified = Column(Boolean, default=False)
    parent_id = Column(Integer, ForeignKey("t_users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    auth_provider = Column(String(50), default="local", nullable=False)
    is_email_verified = Column(Boolean, default=False)
    is_phone_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True, nullable=False)
    avatar_url = Column(String(512), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    # Date de fin de l'onboarding. NULL = compte jamais onboarde : c'est ce qui
    # distingue un email nouvellement cree d'un compte existant, sur tous ses
    # appareils (l'ancien marqueur vivait dans le localStorage du navigateur).
    onboarding_completed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    addresses = relationship("Address", back_populates="owner")
    client_profile = relationship("Client", back_populates="user", uselist=False)
    parent_profile = relationship("Parent", back_populates="user", uselist=False)
    livreur_profile = relationship("Livreur", back_populates="user", uselist=False)
    fournisseur_profile = relationship("Fournisseur", back_populates="user", foreign_keys="Fournisseur.user_id", uselist=False)
    wallet = relationship("Wallet", back_populates="user", uselist=False)
    souki_wallet = relationship("SoukiWallet", back_populates="user", uselist=False)
    paniers = relationship("Panier", back_populates="user")
    user_roles = relationship("UserRole", back_populates="user", foreign_keys="UserRole.user_id")
    notification_preferences = relationship("UserNotificationPreferences", back_populates="user", uselist=False)
    sessions = relationship("UserSession", back_populates="user")
