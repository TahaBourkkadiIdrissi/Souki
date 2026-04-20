import json
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime

from entities.jit_log_entity import JITLog
from interfaces.jit_dao_interface import IJITDao
from dto.jit_dto import JITLogDTO


class JITDaoBD(IJITDao):
    """DAO pour la gestion des logs JIT en base de données"""

    def create_log(
        self,
        session: Session,
        volume_total: float,
        nombre_commandes: int,
        nombre_abonnements: int,
        statut: str,
        details_volumes: Optional[dict] = None,
        message_alerte: Optional[str] = None,
    ) -> Optional[JITLogDTO]:
        """Crée un nouveau log d'exécution JIT"""
        try:
            jit_log = JITLog(
                volume_total=volume_total,
                nombre_commandes=nombre_commandes,
                nombre_abonnements=nombre_abonnements,
                statut=statut,
                details_volumes=json.dumps(details_volumes) if details_volumes else None,
                message_alerte=message_alerte,
            )
            session.add(jit_log)
            session.flush()
            # ✅ NO session.commit() ou refresh() - Laisse le Service gérer la transaction!
            
            # Convertir explicitement les valeurs SQLAlchemy (sans refresh)
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
            )
        except Exception as e:
            print(f"Erreur lors de la création du log JIT: {e}")
            return None

    def get_last_log(self, session: Session) -> Optional[JITLogDTO]:
        """Retourne le dernier log d'exécution"""
        try:
            jit_log = (
                session.query(JITLog)
                .order_by(JITLog.date_execution.desc())
                .first()
            )
            if not jit_log:
                return None
            
            # Convertir explicitement les valeurs SQLAlchemy
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
            )
        except Exception as e:
            print(f"Erreur lors de la récupération du dernier log JIT: {e}")
            return None

    def get_logs_by_date_range(
        self, session: Session, date_debut: str, date_fin: str
    ) -> List[JITLogDTO]:
        """Retourne les logs d'une plage de dates"""
        try:
            date_debut_obj = datetime.fromisoformat(date_debut)
            date_fin_obj = datetime.fromisoformat(date_fin)
            
            jit_logs = (
                session.query(JITLog)
                .filter(
                    JITLog.date_execution >= date_debut_obj,
                    JITLog.date_execution <= date_fin_obj,
                )
                .order_by(JITLog.date_execution.desc())
                .all()
            )
            
            result = []
            for jit_log in jit_logs:
                # Convertir explicitement les valeurs SQLAlchemy
                date_exec = jit_log.date_execution
                date_iso = date_exec.isoformat() if date_exec is not None else None
                
                details_json = None
                if jit_log.details_volumes is not None:
                    details_json = json.loads(jit_log.details_volumes)  # type: ignore
                
                dto = JITLogDTO(
                    id=int(jit_log.id),  # type: ignore
                    date_execution=date_iso,
                    volume_total=float(jit_log.volume_total),  # type: ignore
                    nombre_commandes=int(jit_log.nombre_commandes),  # type: ignore
                    nombre_abonnements=int(jit_log.nombre_abonnements),  # type: ignore
                    statut=str(jit_log.statut),  # type: ignore
                    details_volumes=details_json,
                    message_alerte=str(jit_log.message_alerte) if jit_log.message_alerte else None,  # type: ignore
                )
                result.append(dto)
            
            return result
        except Exception as e:
            print(f"Erreur lors de la récupération des logs JIT: {e}")
            return []
