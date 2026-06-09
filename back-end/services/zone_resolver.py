import math
from typing import Optional, List, Any


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance en km entre deux points géographiques (formule haversine)."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def resoudre_zone(lat: float, lng: float, zones: List[Any]) -> Optional[Any]:
    """
    Retourne la zone (ZoneJIT ou ZoneJITDTO) la plus proche qui contient (lat, lng).
    Si plusieurs zones se chevauchent, choisit celle dont le centre est le plus proche.
    Retourne None si aucune zone ne contient le point.
    """
    meilleure = None
    distance_min = float("inf")
    for zone in zones:
        d = haversine(lat, lng, float(zone.lat_centre), float(zone.lng_centre))
        if d <= float(zone.rayon_km) and d < distance_min:
            meilleure = zone
            distance_min = d
    return meilleure
