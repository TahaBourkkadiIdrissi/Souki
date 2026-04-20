import math
import re
from collections import defaultdict
from datetime import date, datetime, time
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from config import LocalSession, SOUKI_DEPOT_LAT, SOUKI_DEPOT_LNG
from dto.livreur_dto import (
    DemarrerTourneeResponseDTO,
    TourneeItemDTO,
    TourneeResponseDTO,
)
from interfaces.livreur_dao_interface import ILivreurDao
from interfaces.livreur_service_interface import ILivreurService

TOURNEE_RELEASE_TIME = time(7, 0)
PENDING_DELIVERY_STATUSES = {"A_LIVRER", "EN_ATTENTE"}
STARTED_DELIVERY_STATUS = "EN_COURS_DE_LIVRAISON"
VISIBLE_TOURNEE_STATUSES = PENDING_DELIVERY_STATUSES | {STARTED_DELIVERY_STATUS}


class LivreurService(ILivreurService):

    def __init__(self, livreur_dao: ILivreurDao, session: Optional[Session] = None) -> None:
        self.livreur_dao = livreur_dao
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

    def get_tournee(self, livreur_id: int) -> TourneeResponseDTO:
        self._ensure_tournee_available()
        session = self._ensure_session()

        rows = self.livreur_dao.get_tournee_rows(
            session=session,
            livreur_id=livreur_id,
            visible_statuses=VISIBLE_TOURNEE_STATUSES,
        )
        items = [self._build_tournee_item(row) for row in rows]
        sorted_items, sort_strategy = self._sort_items(items)
        tournee_started = any(
            self._normalize_status(item.statut) == STARTED_DELIVERY_STATUS
            for item in sorted_items
        )

        return TourneeResponseDTO(
            date_jour=date.today(),
            sort_strategy=sort_strategy,
            tournee_started=tournee_started,
            items=sorted_items,
        )

    def demarrer_tournee(self, livreur_id: int) -> DemarrerTourneeResponseDTO:
        session = self._ensure_session()
        updated_count = self.livreur_dao.start_tournee(
            session=session,
            livreur_id=livreur_id,
            pending_statuses=PENDING_DELIVERY_STATUSES,
            started_status=STARTED_DELIVERY_STATUS,
        )
        session.commit()

        if updated_count > 0:
            return DemarrerTourneeResponseDTO(
                updated_count=updated_count,
                previous_status="/".join(sorted(PENDING_DELIVERY_STATUSES)),
                new_status=STARTED_DELIVERY_STATUS,
                message="Votre tournee a bien demarre.",
            )

        already_started_count = self.livreur_dao.count_by_statuses(
            session=session,
            livreur_id=livreur_id,
            statuses=[STARTED_DELIVERY_STATUS],
        )
        if already_started_count > 0:
            return DemarrerTourneeResponseDTO(
                updated_count=0,
                previous_status=STARTED_DELIVERY_STATUS,
                new_status=STARTED_DELIVERY_STATUS,
                message="La tournee est deja en cours de livraison.",
            )

        return DemarrerTourneeResponseDTO(
            updated_count=0,
            previous_status="/".join(sorted(PENDING_DELIVERY_STATUSES)),
            new_status=STARTED_DELIVERY_STATUS,
            message="Aucune commande a demarrer pour cette tournee.",
        )

    def _ensure_tournee_available(self) -> None:
        if datetime.now().time() < TOURNEE_RELEASE_TIME:
            raise HTTPException(
                status_code=403,
                detail="Votre tournée sera disponible à partir de 07h00.",
            )

    def _build_tournee_item(self, row: dict) -> TourneeItemDTO:
        street = self._clean_optional_text(row.get("street"))
        neighborhood = self._clean_optional_text(row.get("neighborhood"))
        details = self._clean_optional_text(row.get("details"))
        full_address = self._build_full_address(street, neighborhood, details)
        client_phone = self._clean_optional_text(row.get("client_phone"))

        return TourneeItemDTO(
            commande_id=int(row["commande_id"]),
            client_phone=client_phone,
            client_label=client_phone or f"Client #{row['commande_id']}",
            street=street,
            neighborhood=neighborhood,
            details=details,
            full_address=full_address,
            colis_count=int(row.get("colis_count") or 0),
            creneau_livraison=self._clean_optional_text(row.get("creneau_livraison")),
            statut=str(row.get("statut") or ""),
            montant_total=float(row.get("montant_total") or 0.0),
            mode_paiement=self._clean_optional_text(row.get("mode_paiement")),
            lat=self._as_float(row.get("lat", row.get("latitude"))),
            lng=self._as_float(row.get("lng", row.get("longitude"))),
        )

    def _sort_items(self, items: list[TourneeItemDTO]) -> tuple[list[TourneeItemDTO], str]:
        if not items:
            return items, "EMPTY"

        if self._can_use_greedy_gps(items):
            return self._sort_by_nearest_neighbor(items), "GREEDY_GPS"

        return self._sort_by_neighborhood(items), "NEIGHBORHOOD_CLUSTER"

    def _can_use_greedy_gps(self, items: list[TourneeItemDTO]) -> bool:
        return all(item.lat is not None and item.lng is not None for item in items)

    def _sort_by_neighborhood(self, items: list[TourneeItemDTO]) -> list[TourneeItemDTO]:
        grouped_items: dict[str, list[TourneeItemDTO]] = defaultdict(list)
        for item in items:
            neighborhood_key = (item.neighborhood or "sans-quartier").strip().casefold()
            grouped_items[neighborhood_key].append(item)

        ordered_items: list[TourneeItemDTO] = []
        for neighborhood_key in sorted(grouped_items):
            chunk = grouped_items[neighborhood_key]
            chunk.sort(
                key=lambda item: (
                    self._time_slot_sort_key(item.creneau_livraison),
                    item.commande_id,
                )
            )
            ordered_items.extend(chunk)
        return ordered_items

    def _sort_by_nearest_neighbor(self, items: list[TourneeItemDTO]) -> list[TourneeItemDTO]:
        remaining_items = items.copy()
        ordered_items: list[TourneeItemDTO] = []
        current_lat = SOUKI_DEPOT_LAT
        current_lng = SOUKI_DEPOT_LNG

        while remaining_items:
            next_item = min(
                remaining_items,
                key=lambda item: (
                    self._haversine_km(
                        current_lat,
                        current_lng,
                        item.lat,
                        item.lng,
                    ),
                    self._time_slot_sort_key(item.creneau_livraison),
                    item.commande_id,
                ),
            )
            ordered_items.append(next_item)
            remaining_items.remove(next_item)
            current_lat = next_item.lat
            current_lng = next_item.lng

        return ordered_items

    def _haversine_km(
        self,
        lat1: Optional[float],
        lng1: Optional[float],
        lat2: Optional[float],
        lng2: Optional[float],
    ) -> float:
        if None in (lat1, lng1, lat2, lng2):
            return float("inf")

        earth_radius_km = 6371.0
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)

        haversine_value = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
        )
        return 2 * earth_radius_km * math.asin(math.sqrt(haversine_value))

    def _time_slot_sort_key(self, value: Optional[str]) -> tuple[int, str]:
        if not value:
            return (99, "")
        match = re.search(r"(\d{1,2})", value)
        if not match:
            return (99, value)
        return (int(match.group(1)), value)

    def _build_full_address(
        self,
        street: Optional[str],
        neighborhood: Optional[str],
        details: Optional[str],
    ) -> str:
        address_parts = [part for part in [street, neighborhood] if part]
        full_address = ", ".join(address_parts)
        if details:
            return f"{full_address} ({details})" if full_address else details
        if full_address:
            return full_address
        return "Adresse non renseignee"

    def _normalize_status(self, status: str) -> str:
        return status.strip().upper()

    def _clean_optional_text(self, value: Optional[object]) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    def _as_float(self, value: Optional[object]) -> Optional[float]:
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
