from typing import List, Optional

from sqlalchemy.orm import Session

from entities.address_entity import Address
from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.ligne_panier_entity import LignePanier
from entities.panier_entity import Panier
from entities.product_entity import Product
from entities.user_entity import User
from interfaces.checkout_dao_interface import ICheckoutDao


class CheckoutDaoBD(ICheckoutDao):

    def get_products_by_ids(self, session: Session, product_ids: List[int]) -> List[Product]:
        return (
            session.query(Product)
            .filter(Product.id.in_(product_ids))
            .order_by(Product.id.asc())
            .all()
        )

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
        )
        session.add(commande)
        session.flush()
        return commande
