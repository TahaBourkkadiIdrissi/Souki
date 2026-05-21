import json
from datetime import date, datetime, time
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from dto.jit_dto import JITLogDTO
from entities.jit_log_entity import JITLog
from interfaces.jit_dao_interface import IJITDao


class JITDaoBD(IJITDao):
    """DAO pour la gestion des logs JIT en base de données"""

    def _to_dto(self, jit_log: JITLog) -> JITLogDTO:
        date_exec = jit_log.date_execution
        date_iso = date_exec.isoformat() if date_exec is not None else None
        details_json = None
        if jit_log.details_volumes is not None:
            details_json = json.loads(jit_log.details_volumes)  # type: ignore
        return JITLogDTO(
            id=int(jit_log.id),  # type: ignore
            date_execution=date_iso,
            volume_total=float(jit_log.volume_total),  # type: ignore
            nombre_commandes=int(jit_log.nombre_commandes),  # type: ignore
            nombre_abonnements=int(jit_log.nombre_abonnements),  # type: ignore
            statut=str(jit_log.statut),  # type: ignore
            details_volumes=details_json,
            message_alerte=str(jit_log.message_alerte) if jit_log.message_alerte else None,  # type: ignore
            zone_id=int(jit_log.zone_id) if jit_log.zone_id else None,  # type: ignore
            nom_ville=str(jit_log.nom_ville) if jit_log.nom_ville else None,  # type: ignore
        )

    def create_log(
        self,
        session: Session,
        volume_total: float,
        nombre_commandes: int,
        nombre_abonnements: int,
        statut: str,
        details_volumes: Optional[dict] = None,
        message_alerte: Optional[str] = None,
        zone_id: Optional[int] = None,
        nom_ville: Optional[str] = None,
    ) -> Optional[JITLogDTO]:
        try:
            jit_log = JITLog(
                volume_total=volume_total,
                nombre_commandes=nombre_commandes,
                nombre_abonnements=nombre_abonnements,
                statut=statut,
                details_volumes=json.dumps(details_volumes) if details_volumes else None,
                message_alerte=message_alerte,
                zone_id=zone_id,
                nom_ville=nom_ville,
            )
            session.add(jit_log)
            session.flush()
            # ✅ NO session.commit() - le Service gère la transaction
            return self._to_dto(jit_log)
        except Exception as e:
            print(f"Erreur lors de la création du log JIT: {e}")
            return None

    def get_last_log(self, session: Session) -> Optional[JITLogDTO]:
        try:
            jit_log = (
                session.query(JITLog)
                .order_by(JITLog.date_execution.desc())
                .first()
            )
            return self._to_dto(jit_log) if jit_log else None
        except Exception as e:
            print(f"Erreur lors de la récupération du dernier log JIT: {e}")
            return None

    def get_last_log_by_zone(self, session: Session, zone_id: int) -> Optional[JITLogDTO]:
        try:
            jit_log = (
                session.query(JITLog)
                .filter(JITLog.zone_id == zone_id)
                .order_by(JITLog.date_execution.desc())
                .first()
            )
            return self._to_dto(jit_log) if jit_log else None
        except Exception as e:
            print(f"Erreur get_last_log_by_zone: {e}")
            return None

    def get_last_logs_all_zones(self, session: Session) -> List[JITLogDTO]:
        """Retourne le dernier log par zone (via sous-requête MAX date par zone_id)."""
        try:
            subq = (
                session.query(JITLog.zone_id, func.max(JITLog.date_execution).label("max_date"))
                .filter(JITLog.zone_id.isnot(None))
                .group_by(JITLog.zone_id)
                .subquery()
            )
            logs = (
                session.query(JITLog)
                .join(subq, (JITLog.zone_id == subq.c.zone_id) & (JITLog.date_execution == subq.c.max_date))
                .all()
            )
            return [self._to_dto(l) for l in logs]
        except Exception as e:
            print(f"Erreur get_last_logs_all_zones: {e}")
            return []

    def get_logs_by_date_range(
        self,
        session: Session,
        date_debut: str,
        date_fin: str,
        zone_nom: Optional[str] = None,
    ) -> List[JITLogDTO]:
        try:
            date_debut_obj = datetime.fromisoformat(date_debut)
            date_fin_obj = datetime.fromisoformat(date_fin)

            query = session.query(JITLog).filter(
                JITLog.date_execution >= date_debut_obj,
                JITLog.date_execution <= date_fin_obj,
            )
            if zone_nom:
                query = query.filter(JITLog.nom_ville == zone_nom)

            jit_logs = query.order_by(JITLog.date_execution.desc()).all()
            return [self._to_dto(l) for l in jit_logs]
        except Exception as e:
            print(f"Erreur lors de la récupération des logs JIT: {e}")
            return []

    def zone_deja_executee_aujourd_hui(self, session: Session, zone_id: int) -> bool:
        try:
            today = date.today()
            start = datetime.combine(today, time.min)
            end = datetime.combine(today, time.max)
            count = (
                session.query(JITLog)
                .filter(
                    JITLog.zone_id == zone_id,
                    JITLog.statut == "succès",
                    JITLog.date_execution >= start,
                    JITLog.date_execution <= end,
                )
                .count()
            )
            return count > 0
        except Exception as e:
            print(f"Erreur zone_deja_executee_aujourd_hui: {e}")
            return False
