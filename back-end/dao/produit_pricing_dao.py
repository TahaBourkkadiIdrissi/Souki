from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fastapi import HTTPException

from dto.produit_pricing_dto import ProductCreateDTO, ProduitPricingDTO, ProduitPricingUpdateDTO
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
        produits = (
            session.query(Product)
            .filter(Product.is_active == True)  # noqa: E712
            .order_by(Product.id.asc())
            .all()
        )
        return [self._to_dto(produit) for produit in produits]

    def get_produit_pricing(
        self,
        session: Session,
        produit_id: int,
    ) -> Optional[ProduitPricingDTO]:
        produit = (
            session.query(Product)
            .filter(Product.id == produit_id)
            .filter(Product.is_active == True)  # noqa: E712
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
            .filter(Product.is_active == True)  # noqa: E712
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
            .filter(Product.is_active == True)  # noqa: E712
            .first()
        )
        if produit is None:
            return

        produit.prix_affiche = prix
        session.flush()

    def create_product(self, session: Session, data: ProductCreateDTO) -> Product:
        product = Product(
            nom_fr=data.nom_fr,
            nom_darija=data.nom_darija,
            prix_kg=data.prix_kg,
            unite=data.unite,
            stock=999.0,
            is_active=True,
            niveau=data.niveau or 2,
            marge_cible=data.marge_cible or 0.25,
            coussin_securite=data.coussin_securite or 0.10,
            volatilite=data.volatilite or "STABLE",
            prix_gros_saisi=data.prix_gros_saisi,
            prix_khddar_reel=data.prix_khddar_reel,
            prix_vente_manuel=data.prix_vente_manuel,
        )
        session.add(product)
        session.flush()
        return product

    def get_product_by_nom_darija(self, session: Session, nom_darija: str) -> Optional[Product]:
        """Cherche par nom darija (contrainte UNIQUE en base), actif ou non."""
        return session.query(Product).filter(Product.nom_darija == nom_darija).first()

    def reactivate_product(self, session: Session, product: Product, data: ProductCreateDTO) -> Product:
        """Reactive un produit soft-supprime en lui appliquant les donnees du formulaire,
        comme une creation (l'id et l'historique de commandes sont conserves)."""
        product.nom_fr = data.nom_fr
        product.nom_darija = data.nom_darija
        product.prix_kg = data.prix_kg
        product.unite = data.unite
        product.stock = 999.0
        product.is_active = True
        product.niveau = data.niveau or 2
        product.marge_cible = data.marge_cible or 0.25
        product.coussin_securite = data.coussin_securite or 0.10
        product.volatilite = data.volatilite or "STABLE"
        product.prix_gros_saisi = data.prix_gros_saisi
        product.prix_khddar_reel = data.prix_khddar_reel
        product.prix_vente_manuel = data.prix_vente_manuel
        session.flush()
        return product

    def try_hard_delete_product(self, session: Session, produit_id: int) -> bool:
        """Tente la suppression definitive. Retourne False si le produit est reference
        par des lignes de commande/panier/offres fournisseur (contraintes FK) —
        dans ce cas la ligne est conservee et l'appelant bascule en soft delete.

        DELETE en SQL brut volontairement: session.delete() passerait par l'ORM,
        qui met a NULL le produit_id des lignes enfants (FK nullable) au lieu de
        laisser Postgres lever l'erreur FK — ce qui corromprait l'historique."""
        product = session.query(Product).filter(Product.id == produit_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Produit non trouve")
        try:
            with session.begin_nested():
                session.execute(
                    text('DELETE FROM "T_Product" WHERE id = :produit_id'),
                    {"produit_id": produit_id},
                )
            session.expire_all()
            return True
        except IntegrityError:
            return False

    def deactivate_product(self, session: Session, produit_id: int) -> None:
        product = (
            session.query(Product)
            .filter(Product.id == produit_id)
            .filter(Product.is_active == True)  # noqa: E712
            .first()
        )
        if not product:
            raise HTTPException(status_code=404, detail="Produit non trouve")

        product.is_active = False
        session.flush()

    def update_image_url(self, session: Session, produit_id: int, image_url: str) -> None:
        product = (
            session.query(Product)
            .filter(Product.id == produit_id)
            .filter(Product.is_active == True)  # noqa: E712
            .first()
        )
        if not product:
            raise HTTPException(status_code=404, detail="Produit non trouve")

        product.image_url = image_url
        session.flush()

    def _to_dto(self, produit: Product) -> ProduitPricingDTO:
        niveau = int(produit.niveau or 2)
        coefficient = self._get_coefficient_khddar(produit)
        prix_gros = float(produit.prix_gros_saisi or produit.prix_kg)
        prix_khddar_estime = (
            float(produit.prix_khddar_reel)
            if produit.prix_khddar_reel is not None
            else round(prix_gros * coefficient, 2)
        )

        if produit.prix_gros_saisi is None and produit.prix_vente_manuel is None:
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
            is_active=bool(produit.is_active) if produit.is_active is not None else True,
            image_url=str(produit.image_url) if produit.image_url else None,
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
            prix_khddar_reel=(
                float(produit.prix_khddar_reel)
                if produit.prix_khddar_reel is not None
                else None
            ),
            prix_affiche=(
                float(produit.prix_affiche)
                if produit.prix_affiche is not None
                else None
            ),
            prix_vente_manuel=(
                float(produit.prix_vente_manuel)
                if produit.prix_vente_manuel is not None
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
