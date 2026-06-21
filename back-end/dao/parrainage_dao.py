from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from entities.client_entity import Client
from entities.parrainage_entity import PARRAINAGE_CONVERTI, PARRAINAGE_EN_ATTENTE, Parrainage
from interfaces.parrainage_dao_interface import IParrainageDao


class ParrainageDaoBD(IParrainageDao):
    """DAO parrainage : uniquement des flush(), jamais de commit/rollback."""

    def get_client_by_code(self, session: Session, code: str) -> Optional[Client]:
        return (
            session.query(Client)
            .filter(Client.code_parrainage == code)
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
