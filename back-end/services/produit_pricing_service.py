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

            prix_affiche = self._calculer_prix_affiche(
                prix_gros=produit.prix_gros_saisi,
                marge_cible=produit.marge_cible,
                coussin_securite=produit.coussin_securite,
                prix_vente_manuel=produit.prix_vente_manuel,
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
                prix_affiche = self._calculer_prix_affiche(
                    prix_gros=produit.prix_gros_saisi,
                    marge_cible=produit.marge_cible,
                    coussin_securite=produit.coussin_securite,
                    prix_vente_manuel=produit.prix_vente_manuel,
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

            # Resout le prix des la creation (override -> gros -> None) pour que le produit
            # ne reste pas sans prix (sinon masque du catalogue jusqu'a un recalcul manuel).
            prix_affiche = self._calculer_prix_affiche(
                prix_gros=product.prix_gros_saisi,
                marge_cible=product.marge_cible,
                coussin_securite=product.coussin_securite,
                prix_vente_manuel=product.prix_vente_manuel,
            )
            self.dao.update_prix_affiche(session, int(product.id), prix_affiche)
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
        prix_gros: float | None,
        marge_cible: float,
        coussin_securite: float,
        prix_vente_manuel: float | None = None,
    ) -> float | None:
        # 1. Prix de vente saisi a la main par l'admin : prioritaire, survit au recalcul.
        if prix_vente_manuel is not None:
            return self._arrondi_dixieme_superieur(prix_vente_manuel)

        # 2. Sans prix de gros ni prix manuel, le produit n'a pas de prix fiable :
        #    on laisse None (le produit sera masque du catalogue + alerte cote admin).
        if prix_gros is None:
            return None

        # 3. Calcul standard, tous niveaux : coussin (volatilite) + marge (admin).
        #    Aucune auto-reduction : un depassement du khddar est seulement signale
        #    par l'alerte PRIX_DEPASSE_KHDDAR (DAO), jamais bloque ni rabote.
        prix = prix_gros * (1 + coussin_securite) * (1 + marge_cible)
        return self._arrondi_dixieme_superieur(prix)

    @staticmethod
    def _arrondi_dixieme_superieur(prix: float) -> float:
        # Arrondi au dixieme superieur. Le round(..., 6) neutralise le bruit flottant
        # avant le ceil (sinon 18.00 * 1.05 = 18.900000000000002 -> 19.0 au lieu de 18.9).
        return math.ceil(round(prix * 10, 6)) / 10
