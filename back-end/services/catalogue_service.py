from typing import List, Optional, Tuple

from config import LocalSession
from dto.commande_dto import LigneCommandeDTO
from dto.product_dto import ProductResponseDTO
from interfaces.catalogue_service_interface import ICatalogueService
from interfaces.product_dao_interface import IProductDao
from sqlalchemy.orm import Session


class CatalogueService(ICatalogueService):
    COEFFICIENT_KHDDAR_PRODUIT = {
        "patates": 1.09,
        "tomates": 1.17,
        "citrons": 1.17,
        "haricots": 1.00,
        "oignons": 1.25,
        "carottes": 1.19,
        "navet": 1.25,
        "aubergine": 1.33,
        "khyar": 1.30,
        "feves": 1.40,
        "concombre": 1.44,
        "poivrons": 1.50,
        "courgettes": 1.40,
    }
    COEFFICIENT_KHDDAR_NIVEAU = {1: 1.08, 2: 1.12, 3: 1.25}

    def __init__(
        self, product_dao: IProductDao, session: Optional[Session] = None
    ) -> None:
        self.product_dao = product_dao
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

    def _get_coefficient_khddar(self, produit) -> float:
        nom = (produit.nom_darija or "").lower().strip()
        if nom in self.COEFFICIENT_KHDDAR_PRODUIT:
            return self.COEFFICIENT_KHDDAR_PRODUIT[nom]
        return self.COEFFICIENT_KHDDAR_NIVEAU.get(int(produit.niveau or 2), 1.12)

    def _to_product_response(self, produit) -> ProductResponseDTO:
        prix_gros = produit.prix_gros_saisi or produit.prix_kg
        prix_khddar_estime = (
            float(produit.prix_khddar_reel)
            if produit.prix_khddar_reel is not None
            else round(
                float(prix_gros) * self._get_coefficient_khddar(produit),
                2,
            )
        )
        return ProductResponseDTO(
            id=int(produit.id),# type: ignore
            nom_fr=str(produit.nom_fr),
            nom_darija=str(produit.nom_darija),
            prix_kg=float(produit.prix_kg),# type: ignore
            prix_affiche=(
                float(produit.prix_affiche)
                if produit.prix_affiche is not None
                else float(produit.prix_kg)
            ),
            prix_khddar_estime=prix_khddar_estime,
            is_active=bool(produit.is_active) if produit.is_active is not None else True,
            image_url=str(produit.image_url) if produit.image_url else None,
            niveau=int(produit.niveau or 2),
            unite=str(produit.unite),
            stock=float(produit.stock),# type: ignore
        )

    def get_catalogue_complet(self) -> List[ProductResponseDTO]:
        auto_session = self.session is None
        session = self._ensure_session()
        try:
            products = self.product_dao.get_all(session)
            # On ne masque plus les produits sans prix_affiche, ils utiliseront prix_kg
            return [
                self._to_product_response(p)
                for p in products
            ]
        finally:
            if auto_session:
                self._close_owned_session()

    def get_suggestions(
        self,
        session: Session,
        exclude_ids: list[int],
        panier_total: float = 0.0,
    ) -> List[ProductResponseDTO]:
        produits = self.product_dao.get_suggestions(
            session,
            exclude_ids,
            panier_total,
        )
        return [self._to_product_response(p) for p in produits]

    def valider_et_ajuster_item(
        self, item_gemini: dict
    ) -> Tuple[Optional[LigneCommandeDTO], Optional[str]]:
        auto_session = self.session is None
        alias = item_gemini.get("produit_fr") or item_gemini.get("produit_darija")
        if not alias:
            return None, "Inconnu"

        session = self._ensure_session()
        try:
            produit = self.product_dao.get_by_alias(session, str(alias))
            if not produit:
                return None, alias

            qte_demandee = float(item_gemini.get("quantite", 1.0))
            qte_effective = qte_demandee
            stock = float(produit.stock) # type: ignore
            prix_kg = float(produit.prix_kg)# type: ignore
            message = None

            if qte_demandee > stock:
                qte_effective = stock
                if qte_effective == 0:
                    return None, alias
                message = (
                    f"Stock limite a {stock} {produit.unite} pour {produit.nom_fr}"
                )

            sous_total = round(qte_effective * prix_kg, 2)
            return (
                LigneCommandeDTO(
                    product_id=int(produit.id),# type: ignore
                    nom_produit=str(produit.nom_fr),
                    quantite_demandee=qte_demandee,
                    quantite_effective=qte_effective,
                    prix_unitaire=prix_kg,
                    sous_total=sous_total,
                    message_ajustement=message,
                ),
                None,
            )
        finally:
            if auto_session:
                self._close_owned_session()
