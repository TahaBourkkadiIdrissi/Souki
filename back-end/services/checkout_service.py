from datetime import datetime, time
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session

from config import LocalSession
from dto.checkout_dto import CheckoutRequestDTO, CheckoutResponseDTO
from interfaces.checkout_dao_interface import ICheckoutDao
from interfaces.checkout_service_interface import ICheckoutService


PANIER_MINIMUM_DH = 50.0
SEUIL_LIVRAISON_GRATUITE = 80.0
FRAIS_LIVRAISON = 10.0
DELIVERY_FEE = FRAIS_LIVRAISON
MOROCCO_TIMEZONE = ZoneInfo("Africa/Casablanca")
ORDER_CUTOFF_START = time(21, 30)
ORDER_CUTOFF_END = time(8, 0)
ORDER_CUTOFF_MESSAGE = "Les commandes sont actuellement fermees."
ORDER_CUTOFF_ENABLED = False


def is_order_cutoff_active(now: Optional[datetime] = None) -> bool:
    current_datetime = now or datetime.now(MOROCCO_TIMEZONE)
    if current_datetime.tzinfo is None:
        current_datetime = current_datetime.replace(tzinfo=MOROCCO_TIMEZONE)
    current_time = current_datetime.astimezone(MOROCCO_TIMEZONE).time()
    return current_time >= ORDER_CUTOFF_START or current_time < ORDER_CUTOFF_END


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
        if ORDER_CUTOFF_ENABLED and is_order_cutoff_active():
            raise HTTPException(status_code=403, detail=ORDER_CUTOFF_MESSAGE)

        if not payload.items:
            raise ValueError("Votre panier est vide.")

        auto_session = self.session is None
        session = self._ensure_session()

        try:
            client = self.checkout_dao.get_or_create_client(session, user_id)
            if bool(client.is_blacklisted) and self._is_cod_mode(payload.mode_paiement):
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Votre compte ne peut pas passer de commandes COD. "
                        "Veuillez utiliser Wallet ou CMI."
                    ),
                )

            contact_phone = (payload.contact_phone or "").strip()
            delivery_address = (payload.delivery_address or "").strip()
            delivery_city = (payload.delivery_city or "").strip()
            delivery_instructions = (payload.delivery_instructions or "").strip() or None

            if not contact_phone:
                raise ValueError("Le numero de telephone est obligatoire pour valider la commande.")
            if not delivery_address:
                raise ValueError("L'adresse de livraison est obligatoire pour valider la commande.")
            if not delivery_city:
                raise ValueError("La ville de livraison est obligatoire pour valider la commande.")

            self.checkout_dao.update_user_phone(session, user_id, contact_phone)
            self.checkout_dao.upsert_user_delivery_address(
                session=session,
                user_id=user_id,
                street=delivery_address,
                city=delivery_city,
                details=delivery_instructions,
            )

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

                prix_affiche = getattr(product, "prix_affiche", None)
                unit_price = (
                    float(prix_affiche)
                    if prix_affiche is not None
                    else float(product.prix_kg) # type: ignore
                )
                line_total = round(unit_price * requested_quantity, 2)
                sous_total += line_total
                total_legumes += requested_quantity
                total_articles += 1
                product.stock = available_stock - requested_quantity # type: ignore

            total_produits = round(sous_total, 2)
            if total_produits < PANIER_MINIMUM_DH:
                raise HTTPException(
                    status_code=400,
                    detail=f"Commande minimum {PANIER_MINIMUM_DH} DH",
                )

            is_b2b = False
            if (
                total_produits >= SEUIL_LIVRAISON_GRATUITE
                or getattr(client, 'abonnement_actif', False)
                or is_b2b
            ):
                frais_livraison = 0.0
            else:
                frais_livraison = FRAIS_LIVRAISON

            montant_total = round(total_produits + frais_livraison, 2)
            panier = self.checkout_dao.create_panier(
                session=session,
                user_id=user_id,
                total_legumes=round(total_legumes, 2),
                total_facture=montant_total,
                marge_brute=0.0,
            )

            for item in payload.items:
                product = products_by_id[item.product_id]
                prix_affiche = getattr(product, "prix_affiche", None)
                unit_price = (
                    float(prix_affiche)
                    if prix_affiche is not None
                    else float(product.prix_kg) # type: ignore
                )
                line_total = round(unit_price * float(item.quantity), 2)
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
                statut="EN_ATTENTE",
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
                sous_total=total_produits,
                frais_livraison=frais_livraison,
                montant_total=montant_total,
                message="Commande enregistree avec succes.",
            )
        except Exception:
            session.rollback()
            raise
        finally:
            if auto_session:
                self._close_owned_session()

    def _is_cod_mode(self, mode_paiement: Optional[str]) -> bool:
        normalized_mode = (mode_paiement or "").strip().casefold()
        return normalized_mode in {"cod", "cash", "especes", "especes_livraison", "cash_on_delivery"}
