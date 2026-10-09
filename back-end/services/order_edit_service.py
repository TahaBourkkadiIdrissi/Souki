from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy.orm import Session

from dto.order_edit_dto import OrderEditLineDTO, OrderEditRequestDTO, OrderEditSaveDTO, OrderEditResponseDTO
from interfaces.checkout_dao_interface import ICheckoutDao
from interfaces.order_edit_dao_interface import IOrderEditDao
from interfaces.order_edit_service_interface import IOrderEditService
from operating_mode import preorders_enabled
from services.checkout_service import FRAIS_LIVRAISON, SEUIL_LIVRAISON_GRATUITE
from services.notification_service import notification_service
from services.order_schedule import ORDER_BATCH_LOCK_ID, delivery_cutoff, local_now, orders_closed

COD_MODES = {"cod", "cash", "especes", "especes_livraison", "cash_on_delivery"}


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class OrderEditService(IOrderEditService):
    def __init__(self, dao: IOrderEditDao, checkout_dao: ICheckoutDao, session: Session):
        self.dao, self.checkout_dao, self.session = dao, checkout_dao, session

    def _owned(self, user_id, order_id, *, lock=False):
        order = self.dao.get_owned_order(self.session, order_id, user_id, for_update=lock)
        if order is None:
            raise HTTPException(404, "Commande introuvable.")
        return order

    def _reason(self, order):
        now = local_now()
        if not order.date_livraison or now >= delivery_cutoff(order.date_livraison):
            return "Cette commande est clôturée. Elle ne peut plus être modifiée."
        if orders_closed(now):
            return "Les modifications sont fermées de 01h00 à 08h00."
        if str(order.statut or "").upper() not in {"EN_ATTENTE", "CONFIRMEE"} or order.tournee_id is not None:
            return "Cette commande est déjà en préparation et ne peut plus être modifiée."
        if order.panier is None:
            return "Le panier de cette commande est indisponible."
        mode = str(order.mode_paiement or "").lower()
        if mode not in COD_MODES | {"wallet"}:
            return "La modification de ce mode de paiement nécessite de contacter SOUKI."
        if mode in COD_MODES and (order.payment_validated or (order.paiement and order.paiement.valide)):
            return "Cette commande a déjà été encaissée. Contactez SOUKI."
        if mode in COD_MODES and order.client and order.client.is_blacklisted:
            return "Votre compte ne peut pas modifier une commande en paiement à la livraison."
        return None

    def _assert_editable(self, order):
        reason = self._reason(order)
        if reason:
            raise HTTPException(409, reason)

    def _snapshot(self, order, lines=None, total=None, subtotal=None, previous=None):
        if lines is None:
            lines = []
            for line in (order.panier.lignes if order.panier else []):
                quantity = Decimal(str(line.quantite_kg or 0))
                price = Decimal(str(line.sous_total or 0)) / quantity if quantity else Decimal(0)
                lines.append(OrderEditLineDTO(product_id=line.produit_id,
                    name=line.produit.nom_fr if line.produit else "Produit indisponible",
                    unit=line.produit.unite if line.produit else "kg", quantity=float(quantity),
                    unit_price=float(price), subtotal=float(line.sous_total or 0)))
        subtotal = subtotal if subtotal is not None else sum((money(line.subtotal) for line in lines), Decimal(0))
        total = money(order.montant_total) if total is None else total
        previous = money(order.montant_total) if previous is None else previous
        reason = self._reason(order)
        return OrderEditResponseDTO(commande_id=order.id, version=order.status_version or 1,
            editable=reason is None, reason=reason, server_time=local_now(),
            deadline=delivery_cutoff(order.date_livraison) if order.date_livraison else None,
            date_livraison=order.date_livraison, creneau_livraison=order.creneau_livraison,
            mode_paiement=str(order.mode_paiement or ""), items=lines,
            subtotal=float(subtotal), delivery_fee=float(total - subtotal), total=float(total),
            previous_total=float(previous), difference=float(total - previous))

    def get_order(self, user_id: int, order_id: int) -> OrderEditResponseDTO:
        return self._snapshot(self._owned(user_id, order_id))

    def _prepare(self, user_id: int, order_id: int, payload: OrderEditRequestDTO):
        # Same shared lock as checkout; JIT waits until the whole edit is committed.
        self.checkout_dao.lock_order_batch(self.session, ORDER_BATCH_LOCK_ID)
        order = self._owned(user_id, order_id, lock=True)
        self._assert_editable(order)
        if (order.status_version or 1) != payload.expected_version:
            raise HTTPException(409, "La commande a changé depuis son ouverture. Rechargez-la avant de modifier.")
        original = {line.produit_id: line for line in order.panier.lignes}
        if len(original) != len(order.panier.lignes):
            raise HTTPException(409, "Ce panier comporte des lignes en double. Contactez SOUKI.")
        ids = sorted(set(original) | {item.product_id for item in payload.items})
        products = self.checkout_dao.get_products_by_ids(self.session, ids, for_update=True)
        products = {product.id: product for product in products}
        lines, stock_changes = [], {}
        requested = {item.product_id: item.quantity for item in payload.items}
        for product_id in ids:
            old = original.get(product_id)
            old_quantity = Decimal(str(old.quantite_kg or 0)) if old else Decimal(0)
            quantity = requested.get(product_id, Decimal(0))
            product = products.get(product_id)
            if quantity and product is None:
                raise HTTPException(400, "Un produit est introuvable. Retirez-le de la commande.")
            if product is None:
                continue
            if quantity > old_quantity and not product.is_active:
                raise HTTPException(400, f"{product.nom_fr} n'est plus disponible.")
            if not preorders_enabled():
                available = Decimal(str(product.stock or 0)) + old_quantity
                if quantity > available:
                    raise HTTPException(400, f"Stock insuffisant pour {product.nom_fr}.")
                stock_changes[product_id] = float(available - quantity)
            if not quantity:
                continue
            # Retained products keep their agreed price; only additions use catalogue prices.
            price = (Decimal(str(old.sous_total)) / old_quantity if old and old_quantity else
                     Decimal(str(product.prix_affiche if product.prix_affiche is not None else product.prix_kg)))
            lines.append(OrderEditLineDTO(product_id=product_id, name=product.nom_fr, unit=product.unite,
                         quantity=float(quantity), unit_price=float(price), subtotal=float(money(price * quantity))))
        subtotal = sum((money(line.subtotal) for line in lines), Decimal(0))
        fee = Decimal(0) if subtotal >= Decimal(str(SEUIL_LIVRAISON_GRATUITE)) or (
            order.client and getattr(order.client, "abonnement_actif", False)) else money(FRAIS_LIVRAISON)
        return order, lines, subtotal, subtotal + fee, products, stock_changes

    def preview(self, user_id: int, order_id: int, payload: OrderEditRequestDTO) -> OrderEditResponseDTO:
        try:
            order, lines, subtotal, total, _, _ = self._prepare(user_id, order_id, payload)
            self._assert_editable(order)
            return self._snapshot(order, lines, total, subtotal)
        finally:
            self.session.rollback()  # Preview has no writes; release row and batch locks.

    def save(self, user_id: int, order_id: int, payload: OrderEditSaveDTO) -> OrderEditResponseDTO:
        try:
            order, lines, subtotal, total, products, stock_changes = self._prepare(user_id, order_id, payload)
            if total != payload.expected_total:
                raise HTTPException(409, "Le total a changé. Vérifiez le nouvel aperçu avant de confirmer.")
            previous = money(order.montant_total)
            difference = total - previous
            wallet = None
            if str(order.mode_paiement).lower() == "wallet" and difference:
                wallet = self.dao.get_wallet_for_update(self.session, user_id)
                if wallet is None:
                    raise HTTPException(400, "Portefeuille Souki introuvable.")
                if Decimal(str(wallet.balance)) < difference:
                    raise HTTPException(400, "Solde Wallet insuffisant pour payer la différence. Rechargez votre Wallet.")
            # Product/wallet locks can have waited past 01:00: recheck before any write.
            self._assert_editable(order)
            if wallet is not None:
                self.dao.adjust_wallet(self.session, wallet, difference)
            for product_id, stock in stock_changes.items():
                products[product_id].stock = stock
            self.dao.save_order(self.session, order, lines, total)
            notification_service.notify(self.session, user_id=user_id, event_key="ORDER_UPDATED",
                data={"commande_id": order.id, "montant_total": float(total),
                      "date_livraison": order.date_livraison.isoformat(), "difference": float(difference)},
                dedupe_suffix=f"{order.id}:{order.status_version}")
            result = self._snapshot(order, lines, total, subtotal, previous)
            self.session.commit()
            return result
        except Exception:
            self.session.rollback()
            raise
