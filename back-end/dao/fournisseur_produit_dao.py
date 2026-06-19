from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from entities.fournisseur_produit_entity import FournisseurProduit
from interfaces.fournisseur_produit_dao_interface import IFournisseurProduitDao


class FournisseurProduitDaoBD(IFournisseurProduitDao):

    def list_by_fournisseur(self, session: Session, fournisseur_id: int) -> list[FournisseurProduit]:
        return (
            session.query(FournisseurProduit)
            .filter(FournisseurProduit.fournisseur_id == fournisseur_id)
            .order_by(FournisseurProduit.created_at.asc())
            .all()
        )

    def find(self, session: Session, fournisseur_id: int, produit_id: int) -> Optional[FournisseurProduit]:
        return (
            session.query(FournisseurProduit)
            .filter(
                FournisseurProduit.fournisseur_id == fournisseur_id,
                FournisseurProduit.produit_id == produit_id,
            )
            .first()
        )

    def upsert(
        self,
        session: Session,
        fournisseur_id: int,
        produit_id: int,
        prix_gros: Optional[float],
        stock: float,
        is_active: bool,
    ) -> FournisseurProduit:
        offre = self.find(session, fournisseur_id, produit_id)
        if offre:
            offre.prix_gros = prix_gros
            offre.stock = stock
            offre.is_active = is_active
        else:
            offre = FournisseurProduit(
                fournisseur_id=fournisseur_id,
                produit_id=produit_id,
                prix_gros=prix_gros,
                stock=stock,
                is_active=is_active,
            )
            session.add(offre)
        session.flush()
        return offre

    def delete(self, session: Session, fournisseur_id: int, produit_id: int) -> bool:
        offre = self.find(session, fournisseur_id, produit_id)
        if not offre:
            return False
        session.delete(offre)
        session.flush()
        return True

    def count_active(self, session: Session, fournisseur_id: int) -> int:
        return int(
            session.query(func.count(FournisseurProduit.id))
            .filter(
                FournisseurProduit.fournisseur_id == fournisseur_id,
                FournisseurProduit.is_active.is_(True),
            )
            .scalar()
            or 0
        )

    def replace_selection(self, session: Session, fournisseur_id: int, produit_ids: list[int]) -> None:
        existing = self.list_by_fournisseur(session, fournisseur_id)
        existing_map = {offre.produit_id: offre for offre in existing}

        incoming_set = set(produit_ids)
        existing_set = set(existing_map.keys())

        for pid in existing_set - incoming_set:
            session.delete(existing_map[pid])

        for pid in incoming_set - existing_set:
            session.add(FournisseurProduit(
                fournisseur_id=fournisseur_id,
                produit_id=pid,
                is_active=True,
            ))

        session.flush()
