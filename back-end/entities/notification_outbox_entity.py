from sqlalchemy import Column, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB

from config import Base


class NotificationOutbox(Base):
    """File d'attente transactionnelle des notifications (pattern outbox).

    Les services metier ecrivent ici dans la meme transaction que le changement
    metier : si la commande est annulee, la notification l'est aussi. Le worker
    (DeliveryOutboxWorker) depile ensuite et livre sur le canal `type`.

    `type` = canal de livraison : EMAIL | PUSH | SMS | WEBSOCKET.
    `status` = PENDING | SENT | FAILED | SKIPPED.
    """

    __tablename__ = "t_notification_outbox"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String(20), nullable=False, index=True)
    payload = Column(JSONB, nullable=False)
    status = Column(String(20), nullable=False, default="PENDING", server_default="PENDING", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    # --- Routage (colonnes ajoutees par NotificationSchemaSyncService) ---
    user_id = Column(Integer, nullable=True, index=True)
    event = Column(String(60), nullable=True, index=True)
    # Cle d'idempotence : un index unique partiel garantit qu'un meme evenement
    # ne peut pas etre mis en file deux fois pour le meme destinataire/canal
    # (double clic, retry HTTP, rejeu d'un job).
    dedupe_key = Column(String(180), nullable=True, unique=True)

    # --- Reprise sur echec ---
    attempts = Column(Integer, nullable=False, default=0, server_default="0")
    next_attempt_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_error = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
