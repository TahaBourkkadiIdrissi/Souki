from typing import Dict, Iterable

from sqlalchemy import func
from sqlalchemy.orm import Session

from entities.cod_confirmation_log_entity import CODConfirmationLog
from interfaces.cod_confirmation_log_dao_interface import ICODConfirmationLogDao


class CODConfirmationLogDaoBD(ICODConfirmationLogDao):

    def create_log(
        self,
        session: Session,
        *,
        commande_id: int,
        admin_id: int,
        statut: str,
    ) -> CODConfirmationLog:
        log = CODConfirmationLog(
            commande_id=commande_id,
            admin_id=admin_id,
            statut=statut,
        )
        session.add(log)
        session.flush()
        session.refresh(log)
        return log

    def get_latest_logs_by_commande_ids(
        self,
        session: Session,
        commande_ids: Iterable[int],
    ) -> Dict[int, CODConfirmationLog]:
        ids = list({int(commande_id) for commande_id in commande_ids})
        if not ids:
            return {}

        latest_log_subquery = (
            session.query(
                CODConfirmationLog.commande_id.label("commande_id"),
                func.max(CODConfirmationLog.id).label("latest_log_id"),
            )
            .filter(CODConfirmationLog.commande_id.in_(ids))
            .group_by(CODConfirmationLog.commande_id)
            .subquery()
        )

        logs = (
            session.query(CODConfirmationLog)
            .join(latest_log_subquery, CODConfirmationLog.id == latest_log_subquery.c.latest_log_id)
            .all()
        )

        return {int(log.commande_id): log for log in logs}
