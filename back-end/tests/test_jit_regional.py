"""Tests unitaires pour executer_job_jit_regional() avec mocks."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch, call
import pytest

from dto.jit_dto import (
    DetailProduitJIT,
    JITLogDTO,
    ResultatAgregationJIT,
    ZoneJITDTO,
)


# ============================================================
# Helpers
# ============================================================

def _make_zone(id_, nom, lat, lng, rayon=30.0):
    return ZoneJITDTO(
        id=id_,
        nom_ville=nom,
        lat_centre=lat,
        lng_centre=lng,
        rayon_km=rayon,
        actif=True,
    )


def _make_resultat(nb_commandes=5, statut="succès"):
    return ResultatAgregationJIT(
        nombre_commandes=nb_commandes,
        nombre_abonnements=0,
        volume_total_kg=100.0,
        details_produits=[],
        montant_total=500.0,
        ca_estime_total=500.0,
        cout_achat_estime=300.0,
        marge_estimee=200.0,
        statut=statut,
    )


def _make_log(id_, zone_id, nom_ville, statut="succès"):
    return JITLogDTO(
        id=id_,
        volume_total=100.0,
        nombre_commandes=5,
        nombre_abonnements=0,
        statut=statut,
        zone_id=zone_id,
        nom_ville=nom_ville,
    )


# ============================================================
# Tests executer_job_jit_regional
# ============================================================

class TestExecuterJobJITRegional:

    def _build_service(self, jit_dao_mock, zone_dao_mock):
        """Construit un JITService avec DAOs mockés sans importer config."""
        from services.jit_service import JITService
        service = JITService.__new__(JITService)
        service.jit_dao = jit_dao_mock
        service.zone_jit_dao = zone_dao_mock
        return service

    @patch("services.jit_service.LocalSession")
    @patch("services.jit_service.notifier_fournisseur")
    def test_toutes_zones_succes(self, mock_notif, mock_session_cls):
        """Toutes les zones réussissent → résumé avec statut=succès pour chacune."""
        zone_fes = _make_zone(1, "fes", 34.0331, -5.0003)
        zone_meknes = _make_zone(2, "meknes", 33.8935, -5.5473)

        jit_dao = MagicMock()
        jit_dao.zone_deja_executee_aujourd_hui.return_value = False
        jit_dao.create_log.side_effect = [
            _make_log(10, 1, "fes"),
            _make_log(11, 2, "meknes"),
        ]

        zone_dao = MagicMock()
        zone_dao.get_zones_actives.return_value = [zone_fes, zone_meknes]

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        service = self._build_service(jit_dao, zone_dao)
        service.agreger_commandes = MagicMock(return_value=_make_resultat())
        service.verrouiller_commandes = MagicMock(return_value=5)

        resultats = service.executer_job_jit_regional(actor_id=1)

        assert "fes" in resultats
        assert "meknes" in resultats
        assert resultats["fes"]["statut"] == "succès"
        assert resultats["meknes"]["statut"] == "succès"
        assert mock_notif.call_count == 2

    @patch("services.jit_service.LocalSession")
    @patch("services.jit_service.notifier_fournisseur")
    def test_une_zone_echoue_les_autres_continuent(self, mock_notif, mock_session_cls):
        """Si Meknès lève une exception, Fès doit quand même réussir."""
        zone_fes = _make_zone(1, "fes", 34.0331, -5.0003)
        zone_meknes = _make_zone(2, "meknes", 33.8935, -5.5473)

        jit_dao = MagicMock()
        jit_dao.zone_deja_executee_aujourd_hui.return_value = False
        jit_dao.create_log.return_value = _make_log(10, 1, "fes")

        zone_dao = MagicMock()
        zone_dao.get_zones_actives.return_value = [zone_fes, zone_meknes]

        sessions = [MagicMock(), MagicMock(), MagicMock(), MagicMock()]
        mock_session_cls.side_effect = sessions

        service = self._build_service(jit_dao, zone_dao)

        def agreger_side_effect(session, zone=None):
            if zone and zone.nom_ville == "meknes":
                raise RuntimeError("Erreur DB Meknès simulée")
            return _make_resultat()

        service.agreger_commandes = MagicMock(side_effect=agreger_side_effect)
        service.verrouiller_commandes = MagicMock(return_value=5)

        resultats = service.executer_job_jit_regional(actor_id=1)

        assert resultats["fes"]["statut"] == "succès"
        assert resultats["meknes"]["statut"] == "erreur"
        assert "Meknès" in resultats["meknes"]["message"] or "meknes" in resultats["meknes"]["message"].lower()
        # Fès a été notifiée, pas Meknès
        assert mock_notif.call_count == 1

    @patch("services.jit_service.LocalSession")
    @patch("services.jit_service.notifier_fournisseur")
    def test_zone_deja_executee_ignoree(self, mock_notif, mock_session_cls):
        """Une zone déjà exécutée avec succès aujourd'hui doit être ignorée."""
        zone_fes = _make_zone(1, "fes", 34.0331, -5.0003)

        jit_dao = MagicMock()
        jit_dao.zone_deja_executee_aujourd_hui.return_value = True

        zone_dao = MagicMock()
        zone_dao.get_zones_actives.return_value = [zone_fes]

        mock_session_cls.return_value = MagicMock()

        service = self._build_service(jit_dao, zone_dao)
        service.agreger_commandes = MagicMock()

        resultats = service.executer_job_jit_regional(actor_id=1)

        assert resultats["fes"]["statut"] == "deja_execute"
        service.agreger_commandes.assert_not_called()
        mock_notif.assert_not_called()

    @patch("services.jit_service.LocalSession")
    @patch("services.jit_service.notifier_fournisseur")
    def test_aucune_commande_dans_zone(self, mock_notif, mock_session_cls):
        """Zone sans commandes → statut aucune_commande, pas de verrouillage."""
        zone_fes = _make_zone(1, "fes", 34.0331, -5.0003)

        jit_dao = MagicMock()
        jit_dao.zone_deja_executee_aujourd_hui.return_value = False
        jit_dao.create_log.return_value = _make_log(10, 1, "fes", statut="aucune_commande")

        zone_dao = MagicMock()
        zone_dao.get_zones_actives.return_value = [zone_fes]

        mock_session_cls.return_value = MagicMock()

        service = self._build_service(jit_dao, zone_dao)
        service.agreger_commandes = MagicMock(
            return_value=_make_resultat(nb_commandes=0, statut="aucune_commande")
        )
        service.verrouiller_commandes = MagicMock()

        resultats = service.executer_job_jit_regional(actor_id=1)

        assert resultats["fes"]["statut"] == "aucune_commande"
        service.verrouiller_commandes.assert_not_called()

    @patch("services.jit_service.LocalSession")
    def test_sans_zones_retourne_vide(self, mock_session_cls):
        """Sans zones actives, retourne un dict vide."""
        jit_dao = MagicMock()
        zone_dao = MagicMock()
        zone_dao.get_zones_actives.return_value = []

        mock_session_cls.return_value = MagicMock()

        service = self._build_service(jit_dao, zone_dao)

        resultats = service.executer_job_jit_regional(actor_id=1)

        assert resultats == {}


# ============================================================
# Tests zone_deja_executee_aujourd_hui (DAO)
# ============================================================

class TestZoneDejaExecuteeAujourdhui:

    def test_retourne_false_si_aucun_log(self):
        from dao.jit_dao import JITDaoBD
        dao = JITDaoBD()

        session = MagicMock()
        session.query.return_value.filter.return_value.count.return_value = 0

        assert dao.zone_deja_executee_aujourd_hui(session, zone_id=1) is False

    def test_retourne_true_si_log_succes_existe(self):
        from dao.jit_dao import JITDaoBD
        dao = JITDaoBD()

        session = MagicMock()
        session.query.return_value.filter.return_value.count.return_value = 1

        assert dao.zone_deja_executee_aujourd_hui(session, zone_id=1) is True
