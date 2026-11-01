from decimal import Decimal
from typing import List, Optional
from datetime import date

from sqlalchemy.orm import Session

from entities.address_entity import Address
from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.ligne_panier_entity import LignePanier
from entities.panier_entity import Panier
from entities.product_entity import Product
from entities.souki_wallet_entity import SoukiWallet
from entities.transaction_wallet_entity import TransactionWallet
from entities.user_entity import User
from interfaces.checkout_dao_interface import ICheckoutDao
from services.order_payment import split_debit


class CheckoutDaoBD(ICheckoutDao):

    def lock_order_batch(self, session: Session, key: int) -> None:
        if session.get_bind().dialect.name == "postgresql":
            from sqlalchemy import text
            session.execute(text("SELECT pg_advisory_xact_lock_shared(:key)"), {"key": key})

    def get_products_by_ids(
        self, session: Session, product_ids: List[int], for_update: bool = False
    ) -> List[Product]:
        # L'ordre stable par id garantit un ordre d'acquisition des verrous identique
        # pour tous les checkouts concurrents (anti-deadlock, VULN-006).
        query = (
            session.query(Product)
            .filter(Product.id.in_(product_ids))
            .order_by(Product.id.asc())
        )
        if for_update:
            # SELECT ... FOR UPDATE : lecture du stock, validation et decrementation
            # se font sous verrou de ligne, dans la meme transaction.
            query = query.with_for_update()
        return query.all()

    def get_or_create_client(self, session: Session, user_id: int) -> Client:
        client = session.query(Client).filter(Client.user_id == user_id).first()
        if client is None:
            client = Client(user_id=user_id, code_parrainage=None, is_blacklisted=False)
            session.add(client)
            session.flush()
        return client

    def update_user_phone(self, session: Session, user_id: int, phone: str) -> None:
        existing_user = session.query(User).filter(User.phone == phone, User.id != user_id).first()
        if existing_user is not None:
            raise ValueError("Ce numero de telephone est deja utilise.")
        user = session.query(User).filter(User.id == user_id).first()
        if user is None:
            return
        user.phone = phone
        session.flush()

    def upsert_user_delivery_address(
        self,
        session: Session,
        user_id: int,
        street: str,
        city: str,
        details: Optional[str],
    ) -> None:
        address = (
            session.query(Address)
            .filter(Address.user_id == user_id)
            .order_by(Address.is_default.desc(), Address.id.desc())
            .first()
        )

        if address is None:
            address = Address(
                user_id=user_id,
                street=street,
                neighborhood=city,
                ville=city,
                details=details,
                is_default=True,
            )
            session.add(address)
            session.flush()
            return

        session.query(Address).filter(Address.user_id == user_id, Address.id != address.id).update(
            {Address.is_default: False},
            synchronize_session=False,
        )
        address.street = street
        address.neighborhood = city
        address.ville = city
        address.details = details
        address.is_default = True
        session.flush()

    def create_panier(
        self,
        session: Session,
        user_id: int,
        total_legumes: float,
        total_facture: float,
        marge_brute: float,
    ) -> Panier:
        panier = Panier(
            user_id=user_id,
            total_legumes=total_legumes,
            total_facture=total_facture,
            marge_brute=marge_brute,
        )
        session.add(panier)
        session.flush()
        return panier

    def create_ligne_panier(
        self,
        session: Session,
        panier_id: int,
        produit_id: int,
        quantite_kg: float,
        sous_total: float,
    ) -> LignePanier:
        ligne = LignePanier(
            panier_id=panier_id,
            produit_id=produit_id,
            quantite_kg=quantite_kg,
            sous_total=sous_total,
        )
        session.add(ligne)
        session.flush()
        return ligne

    def create_commande(
        self,
        session: Session,
        client_id: int,
        panier_id: int,
        brouillon_vocal_id : Optional[int],
        statut: str,
        creneau_livraison: str,
        mode_paiement: str,
        montant_total: float,
        date_livraison: Optional[date] = None,
        montant_wallet: float = 0.0,
        montant_wallet_offert: float = 0.0,
    ) -> Commande:
        statut_propre = str(statut or "EN_ATTENTE").strip().upper().replace(" ", "_")

        commande = Commande(
            client_id=client_id,
            panier_id=panier_id,
            brouillon_vocal_id=brouillon_vocal_id,
            statut=statut_propre,
            creneau_livraison=creneau_livraison,
            mode_paiement=mode_paiement,
            montant_total=montant_total,
            montant_wallet=montant_wallet,
            montant_wallet_offert=montant_wallet_offert,
            date_livraison=date_livraison,
        )
        session.add(commande)
        session.flush()
        return commande

    def get_wallet_for_update(self, session: Session, user_id: int) -> Optional[SoukiWallet]:
        return session.query(SoukiWallet).filter(SoukiWallet.user_id == user_id).with_for_update().first()

    def debit_wallet(self, session: Session, wallet: SoukiWallet, amount: Decimal) -> Decimal:
        offert, _ = split_debit(wallet.solde_offert, amount)
        wallet.balance = Decimal(str(wallet.balance or "0.00")) - amount
        wallet.solde_offert = Decimal(str(wallet.solde_offert or "0.00")) - offert
        session.add(TransactionWallet(wallet_id=wallet.id, type="DEBIT_COMMANDE", montant=float(-amount)))
        session.flush()
        return offert
