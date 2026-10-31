import logging
import math
import secrets
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from config import LocalSession
from dto.parrainage_admin_dto import (
    ParrainageAdminItemDTO,
    ParrainageAdminOverviewDTO,
    ParrainageContactsDTO,
    ParrainageTopParrainDTO,
)
from entities.parrainage_entity import (
    PARRAINAGE_CONVERTI,
    PARRAINAGE_EN_ATTENTE,
    PARRAINAGE_REJETE,
    Parrainage,
)
from interfaces.parrainage_dao_interface import IParrainageDao
from interfaces.parrainage_service_interface import IParrainageService
from interfaces.souki_wallet_service_interface import ISoukiWalletService
from services.business_errors import ResourceNotFoundError

audit_logger = logging.getLogger("souki.audit")


# Montant du credit de parrainage (DH). Correspond a la valeur d'un produit
# d'appel dont le cout de revient gros reste inferieur a 3 DH. Configurable.
REFERRAL_CREDIT_DH = 3.0

# Plafond souple anti-farming par IP : au-dela de REFERRAL_IP_CAP parrainages
# enregistres depuis la meme IP sur REFERRAL_IP_WINDOW_DAYS jours, on n'enregistre
# plus. Volontairement souple : des colocataires/voisins partagent la meme IP.
REFERRAL_IP_CAP = 5
REFERRAL_IP_WINDOW_DAYS = 30

# Plafond du nombre de filleuls credites par parrain (anti-farming industriel).
REFERRAL_PARRAIN_CAP = 50

# Types de transactions wallet pour la tracabilite dans l'historique.
# Limite a 20 caracteres : contrainte de la colonne t_transactions_wallet.type.
REFERRAL_TX_TYPE_PARRAIN = "PARRAINAGE_PARRAIN"
REFERRAL_TX_TYPE_FILLEUL = "PARRAINAGE_FILLEUL"

# Code de parrainage : 6 caracteres alphanumeriques sans caracteres ambigus
# (pas de 0/O ni 1/I/L) pour faciliter le partage oral et par SMS.
REFERRAL_CODE_LENGTH = 6
REFERRAL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
REFERRAL_CODE_MAX_ATTEMPTS = 10

# Indices de parrainage suspect affiches a l'admin. Ce sont des indices, pas des preuves :
# une famille partage une adresse, et les operateurs mobiles partagent souvent une IP.
SIGNAL_MEME_ADRESSE = "MEME_ADRESSE"
SIGNAL_MEME_CONNEXION = "MEME_CONNEXION"
SIGNAL_IP_PARTAGEE = "IP_PARTAGEE"
SAME_ADDRESS_RADIUS_M = 30.0


class ParrainageService(IParrainageService):
    """Service metier du parrainage, avec DAO injecte comme le reste du backend."""

    def __init__(
        self,
        parrainage_dao: IParrainageDao,
        souki_wallet_service: Optional[ISoukiWalletService] = None,
        session: Optional[Session] = None,
    ) -> None:
        self.parrainage_dao = parrainage_dao
        self.souki_wallet_service = souki_wallet_service
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

    def convert_on_delivery(self, session: Session, *, filleul_id: int) -> Optional[Parrainage]:
        """Credite parrain et filleul a la 1ere livraison du filleul, une seule fois.

        Appele au passage d'une commande a LIVRE, dans la transaction de livraison.
        Isole dans un savepoint et non bloquant : un souci de parrainage ne doit
        jamais faire echouer la livraison. Idempotent grace au verrou + au statut
        (EN_ATTENTE -> CONVERTI) et a l'unicite de filleul_id.
        """
        if self.souki_wallet_service is None:
            return None

        try:
            with session.begin_nested():
                parrainage = self.parrainage_dao.get_by_filleul(
                    session, filleul_id, for_update=True
                )
                if parrainage is None or parrainage.statut != PARRAINAGE_EN_ATTENTE:
                    return None

                # Garde-fous anti-fraude : parrain blackliste ou plafond atteint
                # => on cloture le parrainage en REJETE, sans aucun credit.
                parrain_client = self.parrainage_dao.get_client_by_id(
                    session, parrainage.parrain_id
                )
                cap_atteint = (
                    self.parrainage_dao.count_converted_by_parrain(
                        session, parrainage.parrain_id
                    )
                    >= REFERRAL_PARRAIN_CAP
                )
                if (parrain_client is not None and bool(parrain_client.is_blacklisted)) or cap_atteint:
                    parrainage.statut = PARRAINAGE_REJETE
                    return parrainage

                amount = Decimal(str(REFERRAL_CREDIT_DH))
                parrain_wallet = self.souki_wallet_service.get_or_create_wallet(
                    parrainage.parrain_id, session=session
                )
                self.souki_wallet_service.credit_wallet(
                    session,
                    wallet=parrain_wallet,
                    amount=amount,
                    transaction_type=REFERRAL_TX_TYPE_PARRAIN,
                )
                filleul_wallet = self.souki_wallet_service.get_or_create_wallet(
                    filleul_id, session=session
                )
                self.souki_wallet_service.credit_wallet(
                    session,
                    wallet=filleul_wallet,
                    amount=amount,
                    transaction_type=REFERRAL_TX_TYPE_FILLEUL,
                )

                parrainage.statut = PARRAINAGE_CONVERTI
                parrainage.credit_parrain = REFERRAL_CREDIT_DH
                parrainage.credit_filleul = REFERRAL_CREDIT_DH
                parrainage.converted_at = datetime.utcnow()
                return parrainage
        except Exception as exc:
            print(f"[PARRAINAGE] Conversion ignoree pour filleul {filleul_id}: {exc}")
            return None

    def get_admin_overview(self, session: Session) -> ParrainageAdminOverviewDTO:
        counts = self.parrainage_dao.count_by_statut(session)
        en_attente = counts.get(PARRAINAGE_EN_ATTENTE, 0)
        convertis = counts.get(PARRAINAGE_CONVERTI, 0)
        rejetes = counts.get(PARRAINAGE_REJETE, 0)
        total = sum(counts.values())
        taux = round((convertis / total) * 100, 2) if total else 0.0

        top_parrains = [
            ParrainageTopParrainDTO(
                parrain_id=int(row[0]),
                parrain_contact=self._mask_contact(row[1], row[2]),
                filleuls_convertis=int(row[3] or 0),
                credit_genere=round(float(row[4] or 0.0), 2),
            )
            for row in self.parrainage_dao.top_parrains(session, limit=5)
        ]

        rows = self.parrainage_dao.list_recent_with_contacts(session, limit=100)
        signaux_par_id = self._compute_signals(session, [row[0] for row in rows])

        recent = []
        for row in rows:
            parrainage = row[0]
            credit_total = round(
                float(parrainage.credit_parrain or 0.0) + float(parrainage.credit_filleul or 0.0),
                2,
            )
            recent.append(
                ParrainageAdminItemDTO(
                    id=int(parrainage.id),
                    parrain_id=int(parrainage.parrain_id),
                    parrain_contact=self._mask_contact(row[1], row[2]),
                    code_utilise=parrainage.code_utilise,
                    filleul_id=int(parrainage.filleul_id),
                    filleul_contact=self._mask_contact(row[3], row[4]),
                    statut=parrainage.statut,
                    credit_total=credit_total,
                    created_at=parrainage.created_at,
                    converted_at=parrainage.converted_at,
                    signaux=signaux_par_id.get(int(parrainage.id), []),
                )
            )

        return ParrainageAdminOverviewDTO(
            total=total,
            en_attente=en_attente,
            convertis=convertis,
            rejetes=rejetes,
            taux_conversion=taux,
            credit_distribue=round(self.parrainage_dao.total_credit_distribue(session), 2),
            top_parrains=top_parrains,
            recent=recent,
        )

    def reveal_contacts(self, session: Session, *, parrainage_id: int, staff_user_id: int) -> ParrainageContactsDTO:
        row = self.parrainage_dao.get_with_contacts(session, parrainage_id)
        if row is None:
            raise ResourceNotFoundError("Parrainage introuvable.")
        parrainage = row[0]
        # Trace d'audit : qui a affiche les coordonnees completes, et de quel parrainage.
        audit_logger.info(
            "[AUDIT] contacts parrainage affiches parrainage_id=%s parrain_id=%s filleul_id=%s staff_user_id=%s at=%s",
            parrainage.id, parrainage.parrain_id, parrainage.filleul_id, staff_user_id, datetime.utcnow().isoformat(),
        )
        return ParrainageContactsDTO(
            parrainage_id=int(parrainage.id),
            parrain_id=int(parrainage.parrain_id),
            parrain_contact=(row[1] or row[2] or None),
            filleul_id=int(parrainage.filleul_id),
            filleul_contact=(row[3] or row[4] or None),
        )

    def _compute_signals(self, session: Session, parrainages: list) -> dict[int, list[str]]:
        if not parrainages:
            return {}
        user_ids = sorted({int(p.parrain_id) for p in parrainages} | {int(p.filleul_id) for p in parrainages})
        points: dict[int, list[tuple[float, float]]] = {}
        for user_id, lat, lng in self.parrainage_dao.list_address_points(session, user_ids):
            points.setdefault(int(user_id), []).append((float(lat), float(lng)))
        session_ips: dict[int, set[str]] = {}
        for user_id, ip in self.parrainage_dao.list_session_ips(session, sorted({int(p.parrain_id) for p in parrainages})):
            session_ips.setdefault(int(user_id), set()).add(str(ip).strip())

        ip_counts: dict[tuple[int, str], int] = {}
        for p in parrainages:
            if p.ip_inscription:
                key = (int(p.parrain_id), p.ip_inscription.strip())
                ip_counts[key] = ip_counts.get(key, 0) + 1

        result: dict[int, list[str]] = {}
        for p in parrainages:
            signaux = []
            parrain_points = points.get(int(p.parrain_id), [])
            filleul_points = points.get(int(p.filleul_id), [])
            if any(
                self._distance_m(a, b) <= SAME_ADDRESS_RADIUS_M
                for a in parrain_points for b in filleul_points
            ):
                signaux.append(SIGNAL_MEME_ADRESSE)
            ip = (p.ip_inscription or "").strip()
            if ip and ip in session_ips.get(int(p.parrain_id), set()):
                signaux.append(SIGNAL_MEME_CONNEXION)
            if ip and ip_counts.get((int(p.parrain_id), ip), 0) > 1:
                signaux.append(SIGNAL_IP_PARTAGEE)
            if signaux:
                result[int(p.id)] = signaux
        return result

    @staticmethod
    def _distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
        lat1, lng1 = map(math.radians, a)
        lat2, lng2 = map(math.radians, b)
        h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
        return 2 * 6_371_000 * math.asin(math.sqrt(h))

    @staticmethod
    def _mask_contact(phone: Optional[str], email: Optional[str]) -> Optional[str]:
        if phone:
            digits = "".join(ch for ch in phone if ch.isdigit())
            # Numeros stockes en +212XXXXXXXXX : affichage national 06 / 07, utile pour distinguer.
            if digits.startswith("212") and len(digits) == 12:
                digits = f"0{digits[3:]}"
            if len(digits) == 10:
                return f"{digits[:2]} •• •• {digits[6:8]} {digits[8:]}"
            if len(digits) <= 4:
                return "•" * len(digits)
            return f"{digits[:2]}{'•' * (len(digits) - 6)}{digits[-4:]}"
        if email:
            local, _, domain = email.partition("@")
            if not domain:
                return "***"
            masked = f"{local[:2]}{'*' * max(1, len(local) - 2)}" if local else "*"
            return f"{masked}@{domain}"
        return None
