from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import relationship
from config import Base


class UserFavorite(Base):
    """Favori produit d'un utilisateur (persistance serveur, cross-device).

    Distinct de l'heuristique « produits frequemment commandes » : ici l'utilisateur
    marque explicitement un produit en favori (coeur). UNIQUE(user_id, produit_id)
    garantit l'idempotence de l'ajout.
    """

    __tablename__ = "t_user_favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "produit_id", name="uq_user_favorites_user_produit"),
    )

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("t_users.id", ondelete="CASCADE"), nullable=False, index=True)
    produit_id = Column(Integer, ForeignKey("T_Product.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    produit = relationship("Product")
