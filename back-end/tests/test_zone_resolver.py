"""Tests unitaires pour zone_resolver.py"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from services.zone_resolver import haversine, resoudre_zone


# ============================================================
# Tests haversine
# ============================================================

class TestHaversine:

    def test_fes_meknes(self):
        # Distance Fès → Meknès ≈ 60 km (source : coordonnées réelles)
        dist = haversine(34.0331, -5.0003, 33.8935, -5.5473)
        assert 55 <= dist <= 65, f"Distance Fès-Meknès attendue ~60 km, obtenu {dist:.1f} km"

    def test_meme_point(self):
        assert haversine(34.0331, -5.0003, 34.0331, -5.0003) == pytest.approx(0.0, abs=0.001)

    def test_distance_symetrique(self):
        d1 = haversine(34.0331, -5.0003, 33.8935, -5.5473)
        d2 = haversine(33.8935, -5.5473, 34.0331, -5.0003)
        assert d1 == pytest.approx(d2, abs=0.001)

    def test_distance_positive(self):
        dist = haversine(0.0, 0.0, 1.0, 1.0)
        assert dist > 0

    def test_fes_casablanca(self):
        # Fès → Casablanca ≈ 290 km
        dist = haversine(34.0331, -5.0003, 33.5731, -7.5898)
        assert 270 <= dist <= 310, f"Distance Fès-Casa attendue ~290 km, obtenu {dist:.1f} km"


# ============================================================
# Zone stub pour les tests
# ============================================================

class ZoneStub:
    def __init__(self, id, nom_ville, lat_centre, lng_centre, rayon_km):
        self.id = id
        self.nom_ville = nom_ville
        self.lat_centre = lat_centre
        self.lng_centre = lng_centre
        self.rayon_km = rayon_km


ZONE_FES = ZoneStub(1, "fes", 34.0331, -5.0003, 30.0)
ZONE_MEKNES = ZoneStub(2, "meknes", 33.8935, -5.5473, 25.0)
ZONE_CASA = ZoneStub(3, "casablanca", 33.5731, -7.5898, 35.0)


# ============================================================
# Tests resoudre_zone
# ============================================================

class TestResoudreZone:

    def test_point_dans_zone_fes(self):
        # Point au centre de Fès → doit être dans la zone
        zone = resoudre_zone(34.0331, -5.0003, [ZONE_FES])
        assert zone is ZONE_FES

    def test_point_hors_zone(self):
        # Casablanca hors de la zone Fès (rayon 30 km)
        zone = resoudre_zone(33.5731, -7.5898, [ZONE_FES])
        assert zone is None

    def test_point_dans_plusieurs_zones_choisit_plus_proche(self):
        # On crée une petite zone qui chevauche Fès
        zone_petite = ZoneStub(10, "fes_centre", 34.0331, -5.0003, 5.0)
        zone_grande = ZoneStub(11, "fes_large", 34.0300, -5.0100, 50.0)
        # Point exactement au centre de zone_petite → distance = 0 → plus proche
        zone = resoudre_zone(34.0331, -5.0003, [zone_grande, zone_petite])
        assert zone is zone_petite

    def test_liste_vide(self):
        zone = resoudre_zone(34.0331, -5.0003, [])
        assert zone is None

    def test_point_juste_dans_rayon(self):
        # Point à ~29 km de Fès (dans rayon 30 km)
        # Décalage en longitude ≈ 0.36° ≈ 30 km à cette latitude
        zone = resoudre_zone(34.0331, -5.0003 - 0.33, [ZONE_FES])
        assert zone is ZONE_FES

    def test_point_juste_hors_rayon(self):
        # Point à ~35 km de Fès (hors rayon 30 km)
        zone = resoudre_zone(34.0331, -5.0003 - 0.45, [ZONE_FES])
        assert zone is None

    def test_meknes_hors_zone_fes(self):
        # Meknès est à ~60 km de Fès, donc hors rayon 30 km
        zone = resoudre_zone(33.8935, -5.5473, [ZONE_FES])
        assert zone is None

    def test_meknes_dans_sa_zone(self):
        zone = resoudre_zone(33.8935, -5.5473, [ZONE_MEKNES])
        assert zone is ZONE_MEKNES

    def test_retourne_bonne_zone_parmi_plusieurs(self):
        # Point centré sur Fès → doit retourner ZONE_FES parmi les 3 zones
        zone = resoudre_zone(34.0331, -5.0003, [ZONE_FES, ZONE_MEKNES, ZONE_CASA])
        assert zone is ZONE_FES
