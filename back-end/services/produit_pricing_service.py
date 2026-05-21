import math

from fastapi import HTTPException
from sqlalchemy.orm import Session

from dto.produit_pricing_dto import (
    ProductCreateDTO,
    ProduitPricingDTO,
    ProduitPricingListDTO,
    ProduitPricingUpdateDTO,
)
from interfaces.produit_pricing_dao_interface import IProduitPricingDao
from interfaces.produit_pricing_service_interface import IProduitPricingService


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


class ProduitPricingServiceBD(IProduitPricingService):

    def __init__(self, dao: IProduitPricingDao) -> None:
        self.dao = dao

    def get_all(self, session: Session) -> ProduitPricingListDTO:
        produits = self.dao.get_all_produits_pricing(session)
        return ProduitPricingListDTO(
            items=produits,
            total=len(produits),
            nb_alertes=sum(1 for produit in produits if produit.alerte is not None),
        )

    def update_pricing(
        self,
        session: Session,
        produit_id: int,
        data: ProduitPricingUpdateDTO,
    ) -> ProduitPricingDTO:
        try:
            produit_existant = self.dao.get_produit_pricing(session, produit_id)
            if produit_existant is None:
                raise HTTPException(status_code=404, detail="Produit introuvable.")

            self.dao.update_produit_pricing(session, produit_id, data)
            produit = self.dao.get_produit_pricing(session, produit_id)
            if produit is None:
                raise HTTPException(status_code=404, detail="Produit introuvable.")

            prix_gros = produit.prix_gros_saisi or produit.prix_kg
            coefficient_khddar = self._get_coefficient_khddar(produit)
            prix_affiche = self._calculer_prix_affiche(
                prix_gros=prix_gros,
                niveau=produit.niveau,
                marge_cible=produit.marge_cible,
                coussin_securite=produit.coussin_securite,
                coefficient_khddar=coefficient_khddar,
                prix_khddar_reel=produit.prix_khddar_reel,
            )
            self.dao.update_prix_affiche(session, produit_id, prix_affiche)
            session.commit()

            produit_recalcule = self.dao.get_produit_pricing(session, produit_id)
            if produit_recalcule is None:
                raise HTTPException(status_code=404, detail="Produit introuvable.")
            return produit_recalcule
        except Exception:
            session.rollback()
            raise

    def recalculer_tous(self, session: Session) -> dict:
        try:
            produits = self.dao.get_all_produits_pricing(session)
            recalcules = 0

            for produit in produits:
                prix_gros = produit.prix_gros_saisi or produit.prix_kg
                coefficient_khddar = self._get_coefficient_khddar(produit)
                prix_affiche = self._calculer_prix_affiche(
                    prix_gros=prix_gros,
                    niveau=produit.niveau,
                    marge_cible=produit.marge_cible,
                    coussin_securite=produit.coussin_securite,
                    coefficient_khddar=coefficient_khddar,
                    prix_khddar_reel=produit.prix_khddar_reel,
                )
                self.dao.update_prix_affiche(session, produit.id, prix_affiche)
                recalcules += 1

            session.commit()

            produits_recalcules = self.dao.get_all_produits_pricing(session)
            alertes = sum(1 for produit in produits_recalcules if produit.alerte is not None)
            return {"recalcules": recalcules, "alertes": alertes}
        except Exception:
            session.rollback()
            raise

    def create_product(self, session: Session, data: ProductCreateDTO) -> ProduitPricingDTO:
        try:
            product = self.dao.create_product(session, data)
            session.commit()

            produit = self.dao.get_produit_pricing(session, int(product.id))
            if produit is None:
                raise HTTPException(status_code=404, detail="Produit introuvable.")
            return produit
        except Exception:
            session.rollback()
            raise

    def deactivate_product(self, session: Session, produit_id: int) -> None:
        try:
            self.dao.deactivate_product(session, produit_id)
            session.commit()
        except Exception:
            session.rollback()
            raise

    def update_image(self, session: Session, produit_id: int, image_url: str) -> ProduitPricingDTO:
        try:
            self.dao.update_image_url(session, produit_id, image_url)
            session.commit()

            produit = self.dao.get_produit_pricing(session, produit_id)
            if produit is None:
                raise HTTPException(status_code=404, detail="Produit introuvable.")
            return produit
        except Exception:
            session.rollback()
            raise

    def _calculer_prix_affiche(
        self,
        prix_gros: float,
        niveau: int,
        marge_cible: float,
        coussin_securite: float,
        coefficient_khddar: float,
        prix_khddar_reel: float | None = None,
    ) -> float:
        if niveau == 1:
            return math.ceil(prix_gros * 10) / 10

        prix = prix_gros * (1 + marge_cible) * (1 + coussin_securite)
        prix_arrondi = math.ceil(prix * 10) / 10

        prix_khddar = (
            prix_khddar_reel
            if prix_khddar_reel is not None
            else prix_gros * coefficient_khddar
        )
        coussin_courant = coussin_securite

        while prix_arrondi > prix_khddar and coussin_courant >= 0:
            coussin_courant -= 0.02
            prix = prix_gros * (1 + marge_cible) * (1 + coussin_courant)
            prix_arrondi = math.ceil(prix * 10) / 10

        return prix_arrondi

    def _get_coefficient_khddar(self, produit) -> float:
        nom = (produit.nom_darija or "").lower().strip()
        if nom in COEFFICIENT_KHDDAR_PRODUIT:
            return COEFFICIENT_KHDDAR_PRODUIT[nom]
        return COEFFICIENT_KHDDAR_NIVEAU.get(produit.niveau, 1.12)
