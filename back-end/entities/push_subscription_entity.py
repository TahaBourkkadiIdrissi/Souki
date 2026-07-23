from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from config import Base


class PushSubscription(Base):
    """Abonnement Web Push (norme RFC 8030) d'un navigateur a un utilisateur.

    Un meme utilisateur peut avoir plusieurs abonnements (telephone, desktop,
    PWA installee). L'endpoint est fourni par le navigateur et identifie de
    maniere unique le couple (navigateur, origine) : il sert donc de cle
    naturelle pour eviter les doublons a chaque re-souscription.
    """

    __tablename__ = "t_push_subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("t_users.id"), nullable=False, index=True)
    endpoint = Column(String(500), nullable=False, unique=True)
    # Cles de chiffrement du message (RFC 8291), fournies par PushSubscription.getKey().
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)
    user_agent = Column(String(255))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    # Renseigne quand le service de push repond 404/410 (abonnement expire) ou
    # quand l'utilisateur se desabonne : on conserve la ligne pour l'audit.
    revoked_at = Column(DateTime(timezone=True), nullable=True, index=True)

    user = relationship("User", foreign_keys=[user_id])
