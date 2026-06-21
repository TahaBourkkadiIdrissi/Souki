import secrets
from typing import Optional

from sqlalchemy.orm import Session

from config import LocalSession
from entities.parrainage_entity import Parrainage
from interfaces.parrainage_dao_interface import IParrainageDao
from interfaces.parrainage_service_interface import IParrainageService


# Montant du credit de parrainage (DH). Correspond a la valeur d'un produit
# d'appel dont le cout de revient gros reste inferieur a 3 DH. Configurable.
REFERRAL_CREDIT_DH = 3.0

# Plafond souple anti-farming par IP : au-dela de REFERRAL_IP_CAP parrainages
# enregistres depuis la meme IP sur REFERRAL_IP_WINDOW_DAYS jours, on n'enregistre
# plus. Volontairement souple : des colocataires/voisins partagent la meme IP.
REFERRAL_IP_CAP = 5
REFERRAL_IP_WINDOW_DAYS = 30

# Code de parrainage : 6 caracteres alphanumeriques sans caracteres ambigus
# (pas de 0/O ni 1/I/L) pour faciliter le partage oral et par SMS.
REFERRAL_CODE_LENGTH = 6
REFERRAL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
REFERRAL_CODE_MAX_ATTEMPTS = 10


class ParrainageService(IParrainageService):
    """Service metier du parrainage, avec DAO injecte comme le reste du backend."""

    def __init__(self, parrainage_dao: IParrainageDao, session: Optional[Session] = None) -> None:
        self.parrainage_dao = parrainage_dao
        self.session = session
        self._owns_session = False

    def _ensure_session(self) -> Session:
        if self.session is None:
            self.session = LocalSession()
            self._owns_session = True
        return self.session

    def __enter__(self):
        self._ensure_session()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.session and self._owns_session:
            if exc_type is not None:
                self.session.rollback()
            else:
                self.session.commit()
            self.session.close()
            self.session = None
            self._owns_session = False

    def generate_unique_code(self, session: Session) -> str:
        for _ in range(REFERRAL_CODE_MAX_ATTEMPTS):
            code = "".join(
                secrets.choice(REFERRAL_CODE_ALPHABET) for _ in range(REFERRAL_CODE_LENGTH)
            )
            if not self.parrainage_dao.code_exists(session, code):
                return code
        raise RuntimeError("Impossible de generer un code de parrainage unique.")

    def create_pending_referral(
        self,
        session: Session,
        *,
        parrain_id: int,
        filleul_id: int,
        code_utilise: str,
        ip_inscription: Optional[str] = None,
        phone_filleul_snapshot: Optional[str] = None,
    ) -> Parrainage:
        return self.parrainage_dao.create_parrainage(
            session,
            parrain_id=parrain_id,
            filleul_id=filleul_id,
            code_utilise=code_utilise,
            ip_inscription=ip_inscription,
            phone_filleul_snapshot=phone_filleul_snapshot,
        )

    def get_referral_by_filleul(
        self,
        session: Session,
        filleul_id: int,
        *,
        for_update: bool = False,
    ) -> Optional[Parrainage]:
        return self.parrainage_dao.get_by_filleul(session, filleul_id, for_update=for_update)
