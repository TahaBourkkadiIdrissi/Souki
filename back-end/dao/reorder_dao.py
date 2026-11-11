from typing import Optional

from sqlalchemy.orm import Session, selectinload

from entities.commande_entity import Commande
from entities.ligne_panier_entity import LignePanier
from entities.panier_entity import Panier
from interfaces.reorder_dao_interface import IReorderDao


class ReorderDaoBD(IReorderDao):
    """Lecture seule : aucune ecriture, donc ni flush ni commit."""

    def get_owned_order_with_products(self, session: Session, order_id: int, user_id: int) -> Optional[Commande]:
        # Filtre sur le proprietaire (anti-IDOR) : la commande d'un autre client renvoie None.
        return (
            session.query(Commande)
            .filter(Commande.id == order_id, Commande.client_id == user_id)
            .options(selectinload(Commande.panier).selectinload(Panier.lignes).selectinload(LignePanier.produit))
            .first()
        )
