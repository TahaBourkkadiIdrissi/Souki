"""Zone de service SOUKI : la clientele cible est a Fes uniquement.

Un compte client n'est cree que si la position de livraison choisie sur la carte
a l'inscription tombe dans cette zone. Miroir cote front :
apps/client/lib/service-area.ts — garder les deux definitions alignees.
"""
from typing import Optional

from services.zone_resolver import haversine

SERVICE_CITY = "Fès"
SERVICE_CENTER_LAT = 34.0331
SERVICE_CENTER_LNG = -5.0003
# Couvre l'agglomeration (Medina, Saiss, Ain Chkef, Bensouda, Sidi Harazem,
# aeroport) sans deborder sur Moulay Yacoub, Sefrou ou Meknes.
SERVICE_RADIUS_KM = 15.0


def is_in_service_area(latitude: float, longitude: float) -> bool:
    distance = haversine(latitude, longitude, SERVICE_CENTER_LAT, SERVICE_CENTER_LNG)
    return distance <= SERVICE_RADIUS_KM


def out_of_area_message(city: Optional[str] = None) -> str:
    place = f"à {city.strip()}" if city and city.strip() else "dans votre ville"
    return (
        f"Désolé, SOUKI n'est pas encore disponible {place}. "
        f"Nous livrons pour le moment uniquement à {SERVICE_CITY}, "
        "mais nous arriverons bientôt chez vous !"
    )
