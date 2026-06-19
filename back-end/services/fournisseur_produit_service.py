from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import LocalSession
from dao.authorization_dao import AuthorizationDao
from entities.fournisseur_produit_entity import FournisseurProduit
from entities.product_entity import Product
from interfaces.fournisseur_produit_dao_interface import IFournisseurProduitDao
from interfaces.fournisseur_produit_service_interface import IFournisseurProduitService
from dto.supplier_dto import (
    SupplierCatalogueItemDTO,
    SupplierProductCreateDTO,
    SupplierProductOfferDTO,
    SupplierProductSelectionDTO,
    SupplierProductUpdateDTO,
    SupplierProductsListDTO,
)


class FournisseurProduitService(IFournisseurProduitService):

    def __init__(
        self,
        fournisseur_produit_dao: IFournisseurProduitDao,
        session: Optional[Session] = None,
    ) -> None:
        self.fournisseur_produit_dao = fournisseur_produit_dao
        self.authorization_dao = AuthorizationDao()
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

    def _ensure_supplier_role(self, session: Session, user_id: int) -> None:
        roles = self.authorization_dao.get_active_role_codes(session, user_id)
        if "FOURNISSEUR" not in roles:
            raise HTTPException(status_code=403, detail="Role fournisseur requis.")

    def _get_product_or_404(self, session: Session, produit_id: int) -> Product:
        product = session.query(Product).filter(Product.id == produit_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Produit introuvable.")
        return product

    def _to_offer_dto(self, offre: FournisseurProduit) -> SupplierProductOfferDTO:
        produit = offre.produit
        return SupplierProductOfferDTO(
            produit_id=int(offre.produit_id),
            nom_fr=produit.nom_fr,
            nom_darija=produit.nom_darija,
            unite=produit.unite,
            prix_affiche=produit.prix_affiche,
            prix_gros=offre.prix_gros,
            stock=float(offre.stock or 0),
            is_active=bool(offre.is_active),
        )

    def list_products(self, user_id: int) -> SupplierProductsListDTO:
        session = self._ensure_session()
        self._ensure_supplier_role(session, user_id)
        offres = self.fournisseur_produit_dao.list_by_fournisseur(session, user_id)
        return SupplierProductsListDTO(items=[self._to_offer_dto(o) for o in offres])

    def list_catalogue(self, user_id: int) -> List[SupplierCatalogueItemDTO]:
        session = self._ensure_session()
        self._ensure_supplier_role(session, user_id)
        produits = (
            session.query(Product)
            .filter(Product.is_active.is_(True))
            .order_by(Product.nom_fr.asc())
            .all()
        )
        offres = self.fournisseur_produit_dao.list_by_fournisseur(session, user_id)
        deja_proposes = {o.produit_id for o in offres}
        return [
            SupplierCatalogueItemDTO(
                produit_id=int(p.id),
                nom_fr=p.nom_fr,
                nom_darija=p.nom_darija,
                unite=p.unite,
                prix_affiche=p.prix_affiche,
                deja_propose=p.id in deja_proposes,
            )
            for p in produits
        ]

    def add_product(self, user_id: int, payload: SupplierProductCreateDTO) -> SupplierProductOfferDTO:
        session = self._ensure_session()
        try:
            self._ensure_supplier_role(session, user_id)
            produit = self._get_product_or_404(session, payload.produit_id)
            if not produit.is_active:
                raise HTTPException(status_code=409, detail="Ce produit n'est pas actif au catalogue.")
            offre = self.fournisseur_produit_dao.upsert(
                session,
                fournisseur_id=user_id,
                produit_id=payload.produit_id,
                prix_gros=payload.prix_gros,
                stock=payload.stock,
                is_active=True,
            )
            session.commit()
            session.refresh(offre)
            return self._to_offer_dto(offre)
        except HTTPException:
            session.rollback()
            raise
        except IntegrityError as exc:
            session.rollback()
            raise HTTPException(status_code=409, detail="Cette offre existe deja.") from exc

    def update_product(
        self,
        user_id: int,
        produit_id: int,
        payload: SupplierProductUpdateDTO,
    ) -> SupplierProductOfferDTO:
        session = self._ensure_session()
        try:
            self._ensure_supplier_role(session, user_id)
            offre = self.fournisseur_produit_dao.find(session, user_id, produit_id)
            if not offre:
                raise HTTPException(status_code=404, detail="Offre introuvable.")
            if payload.prix_gros is not None:
                offre.prix_gros = payload.prix_gros
            if payload.stock is not None:
                offre.stock = payload.stock
            if payload.is_active is not None:
                offre.is_active = payload.is_active
            session.flush()
            session.commit()
            session.refresh(offre)
            return self._to_offer_dto(offre)
        except HTTPException:
            session.rollback()
            raise

    def remove_product(self, user_id: int, produit_id: int) -> None:
        session = self._ensure_session()
        try:
            self._ensure_supplier_role(session, user_id)
            offre = self.fournisseur_produit_dao.find(session, user_id, produit_id)
            if not offre:
                raise HTTPException(status_code=404, detail="Offre introuvable.")
            # Bloquer uniquement si l'offre ciblée est active ET qu'elle est la dernière active
            if offre.is_active and self.fournisseur_produit_dao.count_active(session, user_id) <= 1:
                raise HTTPException(
                    status_code=409,
                    detail="Un fournisseur doit conserver au moins un produit.",
                )
            session.delete(offre)
            session.flush()
            session.commit()
        except HTTPException:
            session.rollback()
            raise

    def set_selection(self, user_id: int, payload: SupplierProductSelectionDTO) -> SupplierProductsListDTO:
        session = self._ensure_session()
        try:
            self._ensure_supplier_role(session, user_id)
            produits = (
                session.query(Product)
                .filter(Product.id.in_(payload.produit_ids))
                .all()
            )
            found_ids = {p.id for p in produits}
            missing = set(payload.produit_ids) - found_ids
            if missing:
                raise HTTPException(
                    status_code=404,
                    detail=f"Produits introuvables: {sorted(missing)}",
                )
            inactive = [p for p in produits if not p.is_active]
            if inactive:
                raise HTTPException(
                    status_code=409,
                    detail=f"Produits inactifs au catalogue: {[p.id for p in inactive]}",
                )
            self.fournisseur_produit_dao.replace_selection(session, user_id, payload.produit_ids)
            session.commit()
            offres = self.fournisseur_produit_dao.list_by_fournisseur(session, user_id)
            return SupplierProductsListDTO(items=[self._to_offer_dto(o) for o in offres])
        except HTTPException:
            session.rollback()
            raise
        except IntegrityError as exc:
            session.rollback()
            raise HTTPException(status_code=409, detail="Conflit lors de la mise a jour de la selection.") from exc
