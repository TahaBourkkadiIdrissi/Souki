"""« Recommander » (tache B9) : les produits d'une commande passee, aux prix du jour.

Meme regle de disponibilite que le catalogue public (CatalogueService._to_product_response) :
un produit actif avec du stock est disponible, ou actif sans stock quand les precommandes sont
ouvertes. Un produit retire, inactif ou en rupture est renvoye avec sa raison, sans prix.
Lecture seule : aucune ecriture, donc ni commit ni rollback.
"""

from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from dto.reorder_dto import ReorderLineDTO, ReorderResponseDTO
from interfaces.reorder_dao_interface import IReorderDao
from interfaces.reorder_service_interface import IReorderService
from operating_mode import preorders_enabled

REASON_REMOVED = "Ce produit n'est plus vendu par SOUKI."
REASON_UNAVAILABLE = "Indisponible aujourd'hui."


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class ReorderService(IReorderService):
    def __init__(self, dao: IReorderDao, session: Session):
        self.dao, self.session = dao, session

    @staticmethod
    def _is_available(product) -> bool:
        if not bool(product.is_active):
            return False
        return float(product.stock or 0) > 0 or preorders_enabled()

    def get_reorder(self, user_id: int, order_id: int) -> ReorderResponseDTO:
        order = self.dao.get_owned_order_with_products(self.session, order_id, user_id)
        if order is None:
            raise HTTPException(404, "Commande introuvable.")

        lines: list[ReorderLineDTO] = []
        total = Decimal(0)
        for line in (order.panier.lignes if order.panier else []):
            product = line.produit
            quantity = float(line.quantite_kg or 0)
            if quantity <= 0:
                continue
            if product is None:
                continue
            available = self._is_available(product)
            price = product.prix_affiche if product.prix_affiche is not None else product.prix_kg
            unit_price = _money(price) if available and price is not None else None
            subtotal = _money(unit_price * Decimal(str(quantity))) if unit_price is not None else None
            if subtotal is not None:
                total += subtotal
            lines.append(ReorderLineDTO(
                product_id=int(product.id),
                nom_fr=str(product.nom_fr),
                nom_ar=getattr(product, "nom_ar", None),
                unite=str(product.unite or "kg"),
                image_url=str(product.image_url) if product.image_url else None,
                quantite=quantity,
                prix_unitaire=float(unit_price) if unit_price is not None else None,
                sous_total=float(subtotal) if subtotal is not None else None,
                disponible=available and unit_price is not None,
                raison=None if available and unit_price is not None else (REASON_REMOVED if not product.is_active else REASON_UNAVAILABLE),
            ))

        return ReorderResponseDTO(
            commande_id=int(order.id),
            lignes=lines,
            total_dh=float(total),
            nombre_disponibles=sum(1 for line in lines if line.disponible),
        )
