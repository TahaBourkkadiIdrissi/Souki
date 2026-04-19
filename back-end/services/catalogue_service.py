from typing import List, Optional, Tuple

from config import LocalSession
from dto.commande_dto import LigneCommandeDTO
from dto.product_dto import ProductResponseDTO
from interfaces.catalogue_service_interface import ICatalogueService
from interfaces.product_dao_interface import IProductDao
from sqlalchemy.orm import Session


class CatalogueService(ICatalogueService):

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

    def get_catalogue_complet(self) -> List[ProductResponseDTO]:
        auto_session = self.session is None
        session = self._ensure_session()
        try:
            products = self.product_dao.get_all(session)
            return [
                ProductResponseDTO(
                    id=int(p.id),# type: ignore
                    nom_fr=str(p.nom_fr),
                    nom_darija=str(p.nom_darija),
                    prix_kg=float(p.prix_kg),# type: ignore
                    unite=str(p.unite),
                    stock=float(p.stock),# type: ignore
                )
                for p in products
            ]
        finally:
            if auto_session:
                self._close_owned_session()

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
