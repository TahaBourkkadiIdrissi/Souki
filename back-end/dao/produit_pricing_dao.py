from typing import List, Optional

from sqlalchemy.orm import Session

from dto.produit_pricing_dto import ProduitPricingDTO, ProduitPricingUpdateDTO
from entities.product_entity import Product
from interfaces.produit_pricing_dao_interface import IProduitPricingDao


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


class ProduitPricingDaoBD(IProduitPricingDao):

    def get_all_produits_pricing(self, session: Session) -> List[ProduitPricingDTO]:
        produits = session.query(Product).order_by(Product.id.asc()).all()
        return [self._to_dto(produit) for produit in produits]

    def get_produit_pricing(
        self,
        session: Session,
        produit_id: int,
    ) -> Optional[ProduitPricingDTO]:
        produit = (
            session.query(Product)
            .filter(Product.id == produit_id)
            .first()
        )
        if produit is None:
            return None
        return self._to_dto(produit)

    def update_produit_pricing(
        self,
        session: Session,
        produit_id: int,
        data: ProduitPricingUpdateDTO,
    ) -> None:
        produit = (
            session.query(Product)
            .filter(Product.id == produit_id)
            .first()
        )
        if produit is None:
            return

        update_data = data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(produit, field, value)

        session.flush()

    def update_prix_affiche(self, session: Session, produit_id: int, prix: float) -> None:
        produit = (
            session.query(Product)
            .filter(Product.id == produit_id)
            .first()
        )
        if produit is None:
            return

        produit.prix_affiche = prix
        session.flush()

    def _to_dto(self, produit: Product) -> ProduitPricingDTO:
        niveau = int(produit.niveau or 2)
        coefficient = self._get_coefficient_khddar(produit)
        prix_gros = float(produit.prix_gros_saisi or produit.prix_kg)
        prix_khddar_estime = round(prix_gros * coefficient, 2)

        if produit.prix_gros_saisi is None:
            alerte = "PRIX_GROS_MANQUANT"
        elif produit.prix_affiche and float(produit.prix_affiche) > prix_khddar_estime:
            alerte = "PRIX_DEPASSE_KHDDAR"
        else:
            alerte = None

        return ProduitPricingDTO(
            id=int(produit.id),
            nom_fr=str(produit.nom_fr),
            nom_darija=str(produit.nom_darija),
            prix_kg=float(produit.prix_kg),
            unite=str(produit.unite),
            marge_cible=(
                float(produit.marge_cible)
                if produit.marge_cible is not None
                else 0.25
            ),
            coussin_securite=(
                float(produit.coussin_securite)
                if produit.coussin_securite is not None
                else 0.10
            ),
            niveau=niveau,
            volatilite=str(produit.volatilite or "STABLE"),
            prix_gros_saisi=(
                float(produit.prix_gros_saisi)
                if produit.prix_gros_saisi is not None
                else None
            ),
            prix_affiche=(
                float(produit.prix_affiche)
                if produit.prix_affiche is not None
                else None
            ),
            prix_khddar_estime=prix_khddar_estime,
            alerte=alerte,
        )

    def _get_coefficient_khddar(self, produit: Product) -> float:
        nom = (produit.nom_darija or "").lower().strip()
        if nom in COEFFICIENT_KHDDAR_PRODUIT:
            return COEFFICIENT_KHDDAR_PRODUIT[nom]
        return COEFFICIENT_KHDDAR_NIVEAU.get(int(produit.niveau or 2), 1.12)
