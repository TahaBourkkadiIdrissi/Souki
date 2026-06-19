import unittest
from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from dto.admin_exception_dto import ReassignerCommandeDTO
from services.admin_exception_service import AdminExceptionService
from services.fournisseur_service import SUPPLIER_ACTIVE_ORDER_STATUSES
from services.livreur_service import VISIBLE_TOURNEE_STATUSES
from controllers.admin_exception_controller import reassigner_commande


def _commande(
    *,
    statut="EN_ATTENTE",
    date_commande=datetime(2026, 6, 19, 10, 0),
    fournisseur_id=10,
):
    return SimpleNamespace(
        id=1,
        statut=statut,
        date_commande=date_commande,
        fournisseur_id=fournisseur_id,
        tournee_id=20,
        ordre_passage=1,
        livreur_id=30,
    )


class ExceptionReasonTests(unittest.TestCase):
    def test_detecte_toutes_les_categories_principales(self):
        today = date(2026, 6, 20)
        cases = [
            (_commande(statut="A_LIVRER", date_commande=datetime(2026, 6, 19)), "JOUR_PRECEDENT"),
            (_commande(statut="BROUILLON"), "BROUILLON"),
            (_commande(statut="CONFIRMEE"), "PENDING_NON_VALIDE"),
            (_commande(statut="RETOUR_DEPOT"), "ECHEC_LIVRAISON"),
            (_commande(statut="A_LIVRER", fournisseur_id=None), "SANS_FOURNISSEUR"),
            (_commande(statut="STATUT_BIZARRE"), "ABERRANT"),
        ]
        for commande, raison in cases:
            with self.subTest(raison=raison):
                self.assertIn(
                    raison,
                    AdminExceptionService.detect_raisons(commande, today=today),
                )

    def test_une_commande_peut_cumuler_plusieurs_raisons(self):
        commande = _commande(
            statut="STATUT_BIZARRE",
            date_commande=datetime(2026, 6, 19),
            fournisseur_id=None,
        )
        raisons = AdminExceptionService.detect_raisons(
            commande,
            today=date(2026, 6, 20),
        )
        self.assertEqual(
            raisons,
            ["JOUR_PRECEDENT", "SANS_FOURNISSEUR", "ABERRANT"],
        )

    def test_livre_et_annulee_du_jour_sont_exclus_par_defaut(self):
        today = date(2026, 6, 20)
        self.assertEqual(
            AdminExceptionService.detect_raisons(
                _commande(statut="LIVRE", date_commande=datetime(2026, 6, 20)),
                today=today,
            ),
            [],
        )
        annulee = _commande(statut="ANNULEE", date_commande=datetime(2026, 6, 20))
        self.assertEqual(
            AdminExceptionService.detect_raisons(annulee, today=today),
            [],
        )
        self.assertEqual(
            AdminExceptionService.detect_raisons(
                annulee,
                today=today,
                include_annulee=True,
            ),
            ["ANNULEE"],
        )


class ExceptionActionTests(unittest.TestCase):
    def test_rattacher_fournisseur_pose_fournisseur_id(self):
        session = MagicMock()
        service = AdminExceptionService(session)
        commande = _commande(statut="CONFIRMEE", fournisseur_id=None)
        service._get_commande_for_update = MagicMock(return_value=commande)
        fournisseur = SimpleNamespace(user_id=55, statut="APPROVED")
        query = MagicMock()
        query.filter.return_value = query
        query.first.return_value = fournisseur
        session.query.return_value = query

        result = service.rattacher_fournisseur(1, 55)

        self.assertEqual(commande.fournisseur_id, 55)
        self.assertEqual(result.fournisseur_id, 55)
        session.commit.assert_called_once()

    @patch("services.admin_exception_service.changer_statut")
    def test_replanifier_detache_la_tournee(self, changer_statut_mock):
        session = MagicMock()
        service = AdminExceptionService(session)
        commande = _commande(statut="RETOUR_DEPOT")
        service._get_commande_for_update = MagicMock(return_value=commande)
        service._resolve_open_anomalies = MagicMock()

        result = service.replanifier(1, 999)

        self.assertEqual(result.nouveau_statut, "EN_ATTENTE")
        self.assertIsNone(commande.tournee_id)
        self.assertIsNone(commande.ordre_passage)
        self.assertIsNone(commande.livreur_id)
        self.assertEqual(
            changer_statut_mock.call_args.kwargs["reason"],
            "ADMIN_REPLANIFIE",
        )

    @patch("services.admin_exception_service.changer_statut")
    def test_annuler_utilise_changer_statut(self, changer_statut_mock):
        session = MagicMock()
        service = AdminExceptionService(session)
        commande = _commande(statut="CONFIRMEE")
        service._get_commande_for_update = MagicMock(return_value=commande)
        service._resolve_open_anomalies = MagicMock()

        result = service.annuler(1, 999)

        self.assertEqual(result.nouveau_statut, "ANNULEE")
        self.assertEqual(
            changer_statut_mock.call_args.kwargs["reason"],
            "ADMIN_ANNULE",
        )

    def test_reassigner_delegue_au_dispatch(self):
        dispatch = MagicMock()
        dispatch.__enter__.return_value = dispatch
        dispatch.reassign_commande.return_value = {"status": "success"}
        principal = SimpleNamespace(user_id=999)

        result = reassigner_commande(
            commande_id=1,
            payload=ReassignerCommandeDTO(nouvelle_tournee_id=88),
            principal=principal,
            dispatch_service=dispatch,
        )

        self.assertEqual(result["status"], "success")
        dispatch.reassign_commande.assert_called_once_with(
            commande_id=1,
            nouvelle_tournee_id=88,
        )


class ExceptionCloisonnementTests(unittest.TestCase):
    def test_whitelists_fournisseur_et_livreur_restent_strictes(self):
        self.assertEqual(
            set(SUPPLIER_ACTIVE_ORDER_STATUSES),
            {"VERROUILLEE", "EN_ATTENTE_LIVREUR", "A_LIVRER"},
        )
        self.assertEqual(
            set(VISIBLE_TOURNEE_STATUSES),
            {"EN_ATTENTE_LIVREUR", "A_LIVRER", "EN_ROUTE"},
        )


if __name__ == "__main__":
    unittest.main()
