from typing import List

from sqlalchemy.orm import Session

from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.ligne_panier_entity import LignePanier
from entities.panier_entity import Panier
from entities.product_entity import Product
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
        statut: str,
        creneau_livraison: str,
        mode_paiement: str,
        montant_total: float,
    ) -> Commande:
        commande = Commande(
            client_id=client_id,
            panier_id=panier_id,
            livreur_id=None,
            statut=statut,
            creneau_livraison=creneau_livraison,
            mode_paiement=mode_paiement,
            montant_total=montant_total,
        )
        session.add(commande)
        session.flush()
        return commande
