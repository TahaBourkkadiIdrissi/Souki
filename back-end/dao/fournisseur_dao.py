from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from entities.fournisseur_entity import Fournisseur
from entities.user_entity import User
from interfaces.fournisseur_dao_interface import IFournisseurDao


class FournisseurDaoBD(IFournisseurDao):

    def find_by_user_id(self, session: Session, user_id: int) -> Optional[Fournisseur]:
        return session.query(Fournisseur).filter(Fournisseur.user_id == user_id).first()

    def find_by_statut(self, session: Session, statut: str) -> list[Fournisseur]:
        return (
            session.query(Fournisseur)
            .filter(func.upper(Fournisseur.statut) == statut.upper())
            .order_by(Fournisseur.created_at.desc())
            .all()
        )

    def find_by_ville(self, session: Session, ville: str) -> list[Fournisseur]:
        normalized_ville = ville.strip().casefold()
        return (
            session.query(Fournisseur)
            .filter(func.lower(Fournisseur.ville) == normalized_ville)
            .order_by(Fournisseur.shop_name.asc())
            .all()
        )

    def exists_by_user_id(self, session: Session, user_id: int) -> bool:
        return (
            session.query(Fournisseur.user_id)
            .filter(Fournisseur.user_id == user_id)
            .first()
            is not None
        )

    def find_by_shop_slug(self, session: Session, shop_slug: str) -> Optional[Fournisseur]:
        return session.query(Fournisseur).filter(Fournisseur.shop_slug == shop_slug).first()

    def count_by_statut(self, session: Session, statut: str) -> int:
        return int(
            session.query(func.count(Fournisseur.user_id))
            .filter(func.upper(Fournisseur.statut) == statut.upper())
            .scalar()
            or 0
        )

    def save(self, session: Session, fournisseur: Fournisseur) -> Fournisseur:
        session.add(fournisseur)
        session.flush()
        return fournisseur

    def get_pending_with_user(self, session: Session) -> list[dict]:
        rows = (
            session.query(Fournisseur, User)
            .join(User, User.id == Fournisseur.user_id)
            .filter(Fournisseur.statut == "PENDING")
            .order_by(Fournisseur.created_at.asc())
            .all()
        )
        return [{"fournisseur": fournisseur, "user": user} for fournisseur, user in rows]

    def search_page(
        self,
        session: Session,
        *,
        statut: Optional[str],
        ville: Optional[str],
        search: Optional[str],
        page: int,
        page_size: int,
    ) -> tuple[list[dict], int]:
        query = session.query(Fournisseur, User).join(User, User.id == Fournisseur.user_id)

        if statut:
            query = query.filter(func.upper(Fournisseur.statut) == statut.upper())
        if ville:
            query = query.filter(func.lower(Fournisseur.ville) == ville.strip().casefold())
        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Fournisseur.shop_name.ilike(pattern),
                    Fournisseur.shop_slug.ilike(pattern),
                    User.email.ilike(pattern),
                    User.phone.ilike(pattern),
                )
            )

        total = int(query.with_entities(func.count(Fournisseur.user_id)).scalar() or 0)
        rows = (
            query.order_by(Fournisseur.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return [{"fournisseur": fournisseur, "user": user} for fournisseur, user in rows], total
