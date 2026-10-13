/**
 * Zone de service SOUKI : la clientele cible est a Fes uniquement.
 *
 * Miroir de back-end/services/service_area.py, qui refuse aussi l'inscription
 * hors zone — garder les deux definitions alignees.
 */

export type Coordinates = { latitude: number; longitude: number }

export const SERVICE_CITY = "Fès"
export const SERVICE_CENTER: Coordinates = { latitude: 34.0331, longitude: -5.0003 }
// Couvre l'agglomeration (Medina, Saiss, Ain Chkef, Bensouda, Sidi Harazem,
// aeroport) sans deborder sur Moulay Yacoub, Sefrou ou Meknes.
export const SERVICE_RADIUS_KM = 15

const EARTH_RADIUS_KM = 6371

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Distance a vol d'oiseau (formule haversine), comme services/zone_resolver.py. */
function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude)
  const dLng = toRadians(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function isInServiceArea(point: Coordinates): boolean {
  return distanceKm(point, SERVICE_CENTER) <= SERVICE_RADIUS_KM
}
