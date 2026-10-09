from decimal import Decimal
from sqlalchemy.orm import Session, selectinload
from dto.order_edit_dto import OrderEditLineDTO
from entities.commande_entity import Commande
from entities.panier_entity import Panier
from entities.ligne_panier_entity import LignePanier
from entities.souki_wallet_entity import SoukiWallet
from entities.transaction_wallet_entity import TransactionWallet
from interfaces.order_edit_dao_interface import IOrderEditDao


class OrderEditDaoBD(IOrderEditDao):
    def get_owned_order(self, session: Session, order_id: int, user_id: int, *, for_update: bool = False):
        query = session.query(Commande).filter(Commande.id == order_id, Commande.client_id == user_id)
        if for_update:
            query = query.with_for_update(of=Commande)
        return query.options(
            selectinload(Commande.panier).selectinload(Panier.lignes).selectinload(LignePanier.produit),
            selectinload(Commande.client), selectinload(Commande.paiement),
        ).populate_existing().first()

    def get_wallet_for_update(self, session: Session, user_id: int):
        return session.query(SoukiWallet).filter(SoukiWallet.user_id == user_id).with_for_update().first()

    def adjust_wallet(self, session: Session, wallet: SoukiWallet, difference: Decimal) -> None:
        wallet.balance = Decimal(str(wallet.balance)) - difference
        session.add(TransactionWallet(wallet_id=wallet.id,
                    type="DEBIT_MODIFICATION" if difference > 0 else "CREDIT_MODIFICATION",
                    montant=float(-difference)))
        session.flush()

    def save_order(self, session: Session, order: Commande, lines: list[OrderEditLineDTO], total: Decimal) -> None:
        # Preserve IDs for retained lines (history and later claims refer to them).
        existing = {line.produit_id: line for line in order.panier.lignes}
        desired = {line.product_id for line in lines}
        for line in list(order.panier.lignes):
            if line.produit_id not in desired:
                order.panier.lignes.remove(line)
                session.delete(line)
        for item in lines:
            line = existing.get(item.product_id)
            if line is None:
                line = LignePanier(produit_id=item.product_id)
                order.panier.lignes.append(line)
            line.quantite_kg = item.quantity
            line.sous_total = item.subtotal
        order.panier.total_legumes = round(sum(item.quantity for item in lines), 3)
        order.panier.total_facture = float(total)
        order.montant_total = float(total)
        order.status_version = (order.status_version or 1) + 1
        if order.paiement is not None:
            order.paiement.montant = float(total)
            order.paiement.montant_net = float(total) - float(order.paiement.frais_cmi or 0)
        session.flush()
