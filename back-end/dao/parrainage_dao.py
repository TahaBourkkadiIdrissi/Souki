from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, aliased

from entities.client_entity import Client
from entities.parrainage_entity import PARRAINAGE_CONVERTI, PARRAINAGE_EN_ATTENTE, Parrainage
from entities.user_entity import User
from interfaces.parrainage_dao_interface import IParrainageDao


class ParrainageDaoBD(IParrainageDao):
    """DAO parrainage : uniquement des flush(), jamais de commit/rollback."""

    def get_client_by_code(self, session: Session, code: str) -> Optional[Client]:
        return (
            session.query(Client)
            .filter(Client.code_parrainage == code)
            .first()
        )

    def get_client_by_id(self, session: Session, user_id: int) -> Optional[Client]:
        return (
            session.query(Client)
            .filter(Client.user_id == user_id)
            .first()
        )

    def code_exists(self, session: Session, code: str) -> bool:
        return (
            session.query(Client.user_id)
            .filter(Client.code_parrainage == code)
            .first()
            is not None
        )

    def create_parrainage(
        self,
        session: Session,
        *,
        parrain_id: int,
        filleul_id: int,
        code_utilise: str,
        ip_inscription: Optional[str] = None,
        phone_filleul_snapshot: Optional[str] = None,
    ) -> Parrainage:
        parrainage = Parrainage(
            parrain_id=parrain_id,
            filleul_id=filleul_id,
            code_utilise=code_utilise,
            statut=PARRAINAGE_EN_ATTENTE,
            ip_inscription=ip_inscription,
            phone_filleul_snapshot=phone_filleul_snapshot,
        )
        session.add(parrainage)
        session.flush()
        return parrainage

    def get_by_filleul(
        self,
        session: Session,
        filleul_id: int,
        *,
        for_update: bool = False,
    ) -> Optional[Parrainage]:
        query = session.query(Parrainage).filter(Parrainage.filleul_id == filleul_id)
        if for_update:
            query = query.with_for_update()
        return query.first()

    def count_converted_by_parrain(self, session: Session, parrain_id: int) -> int:
        return int(
            session.query(func.count(Parrainage.id))
            .filter(
                Parrainage.parrain_id == parrain_id,
                Parrainage.statut == PARRAINAGE_CONVERTI,
            )
            .scalar()
            or 0
        )

    def count_recent_by_ip(self, session: Session, ip: str, since: datetime) -> int:
        return int(
            session.query(func.count(Parrainage.id))
            .filter(
                Parrainage.ip_inscription == ip,
                Parrainage.created_at >= since,
            )
            .scalar()
            or 0
        )

    def count_by_statut(self, session: Session) -> dict:
        rows = (
            session.query(Parrainage.statut, func.count(Parrainage.id))
            .group_by(Parrainage.statut)
            .all()
        )
        return {str(statut): int(count) for statut, count in rows}

    def total_credit_distribue(self, session: Session) -> float:
        return float(
            session.query(
                func.coalesce(
                    func.sum(
                        func.coalesce(Parrainage.credit_parrain, 0.0)
                        + func.coalesce(Parrainage.credit_filleul, 0.0)
                    ),
                    0.0,
                )
            )
            .filter(Parrainage.statut == PARRAINAGE_CONVERTI)
            .scalar()
            or 0.0
        )

    def top_parrains(self, session: Session, limit: int = 5) -> list:
        parrain_user = aliased(User)
        return (
            session.query(
                Parrainage.parrain_id,
                parrain_user.phone,
                parrain_user.email,
                func.count(Parrainage.id),
                func.coalesce(func.sum(func.coalesce(Parrainage.credit_parrain, 0.0)), 0.0),
            )
            .outerjoin(parrain_user, parrain_user.id == Parrainage.parrain_id)
            .filter(Parrainage.statut == PARRAINAGE_CONVERTI)
            .group_by(Parrainage.parrain_id, parrain_user.phone, parrain_user.email)
            .order_by(func.count(Parrainage.id).desc())
            .limit(limit)
            .all()
        )

    def list_recent_with_contacts(self, session: Session, limit: int = 100) -> list:
        parrain_user = aliased(User)
        filleul_user = aliased(User)
        return (
            session.query(
                Parrainage,
                parrain_user.phone,
                parrain_user.email,
                filleul_user.phone,
                filleul_user.email,
            )
            .outerjoin(parrain_user, parrain_user.id == Parrainage.parrain_id)
            .outerjoin(filleul_user, filleul_user.id == Parrainage.filleul_id)
            .order_by(Parrainage.created_at.desc())
            .limit(limit)
            .all()
        )
