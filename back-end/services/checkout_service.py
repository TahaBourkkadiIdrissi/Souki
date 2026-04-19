from typing import Optional

from sqlalchemy.orm import Session

from config import LocalSession
from dto.checkout_dto import CheckoutRequestDTO, CheckoutResponseDTO
from interfaces.checkout_dao_interface import ICheckoutDao
from interfaces.checkout_service_interface import ICheckoutService


DELIVERY_FEE = 10.0


class CheckoutService(ICheckoutService):

    def __init__(self, checkout_dao: ICheckoutDao, session: Optional[Session] = None) -> None:
        self.checkout_dao = checkout_dao
        self.session = session
        self._owns_session = False

    def _ensure_session(self) -> Session:
        if self.session is None:
            self.session = LocalSession()
            self._owns_session = True
        return self.session

    def _close_owned_session(self, rollback: bool = False) -> None:
        if self.session and self._owns_session:
            if rollback:
                self.session.rollback()
            self.session.close()
            self.session = None
            self._owns_session = False

    def __enter__(self):
        self._ensure_session()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._close_owned_session(rollback=exc_type is not None)

    def create_checkout(
        self, user_id: int, payload: CheckoutRequestDTO
    ) -> CheckoutResponseDTO:
        if not payload.items:
            raise ValueError("Votre panier est vide.")

        auto_session = self.session is None
        session = self._ensure_session()

        try:
            client = self.checkout_dao.get_or_create_client(session, user_id)
            if bool(client.is_blacklisted):
                raise ValueError("Ce compte ne peut pas valider de commande pour le moment.")

            product_ids = [item.product_id for item in payload.items]
            products = self.checkout_dao.get_products_by_ids(session, product_ids)
            products_by_id = {int(product.id): product for product in products} # type: ignore

            if len(products_by_id) != len(set(product_ids)):
                raise ValueError("Un ou plusieurs produits du panier sont introuvables.")

            total_articles = 0
            total_legumes = 0.0
            sous_total = 0.0

            for item in payload.items:
                if item.quantity <= 0:
                    raise ValueError("Chaque ligne du panier doit avoir une quantite positive.")

                product = products_by_id[item.product_id]
                requested_quantity = float(item.quantity)
                available_stock = float(product.stock) # type: ignore

                if available_stock < requested_quantity:
                    raise ValueError(
                        f"Stock insuffisant pour {product.nom_fr}. Disponible: {available_stock} {product.unite}."
                    )

                line_total = round(float(product.prix_kg) * requested_quantity, 2) # type: ignore
                sous_total += line_total
                total_legumes += requested_quantity
                total_articles += 1
                product.stock = available_stock - requested_quantity # type: ignore

            montant_total = round(sous_total + DELIVERY_FEE, 2)
            panier = self.checkout_dao.create_panier(
                session=session,
                user_id=user_id,
                total_legumes=round(total_legumes, 2),
                total_facture=montant_total,
                marge_brute=0.0,
            )

            for item in payload.items:
                product = products_by_id[item.product_id]
                line_total = round(float(product.prix_kg) * float(item.quantity), 2) # type: ignore
                self.checkout_dao.create_ligne_panier(
                    session=session,
                    panier_id=int(panier.id), # type: ignore
                    produit_id=item.product_id,
                    quantite_kg=float(item.quantity),
                    sous_total=line_total,
                )

            commande = self.checkout_dao.create_commande(
                session=session,
                client_id=int(client.user_id), # type: ignore
                panier_id=int(panier.id), # type: ignore
                brouillon_vocal_id=payload.brouillon_vocal_id,
                statut="en_attente",
                creneau_livraison=payload.creneau_livraison,
                mode_paiement=payload.mode_paiement,
                montant_total=montant_total,
            )

            session.commit()

            return CheckoutResponseDTO(
                status="success",
                commande_id=int(commande.id), # type: ignore
                panier_id=int(panier.id), # type: ignore
                total_articles=total_articles,
                sous_total=round(sous_total, 2),
                frais_livraison=DELIVERY_FEE,
                montant_total=montant_total,
                message="Commande enregistree avec succes.",
            )
        except Exception:
            session.rollback()
            raise
        finally:
            if auto_session:
                self._close_owned_session()
