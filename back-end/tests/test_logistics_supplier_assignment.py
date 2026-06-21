import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from dto.jit_dto import ZoneJITDTO
from services.fournisseur_resolver import resoudre_fournisseur_pour_commande
from services.jit_service import JITService
from services.notification_jit_service import notifier_fournisseur


class _AddressQuery:
    def __init__(self, address):
        self.address = address

    def filter(self, *args):
        return self

    def first(self):
        return self.address


class _ResolverSession:
    def __init__(self, address):
        self.address = address

    def query(self, model):
        return _AddressQuery(self.address)


class FournisseurResolverTests(unittest.TestCase):
    def test_resout_le_fournisseur_de_la_zone(self):
        session = _ResolverSession(
            SimpleNamespace(latitude=33.5731, longitude=-7.5898)
        )
        commande = SimpleNamespace(client_id=42)
        zone = ZoneJITDTO(
            id=1,
            nom_ville="casablanca",
            lat_centre=33.5731,
            lng_centre=-7.5898,
            rayon_km=10,
            fournisseur_id=99,
        )

        self.assertEqual(
            resoudre_fournisseur_pour_commande(session, commande, [zone]),
            99,
        )

    def test_retourne_none_sans_zone(self):
        session = _ResolverSession(None)
        commande = SimpleNamespace(client_id=42)
        self.assertIsNone(
            resoudre_fournisseur_pour_commande(session, commande, []),
        )


class JITAssignmentTests(unittest.TestCase):
    def test_verrouillage_pose_le_fournisseur(self):
        commande = SimpleNamespace(id=7, client_id=42, statut="CONFIRMEE", fournisseur_id=None)
        session = Mock()
        zone_dao = Mock()
        zone_dao.get_zones_actives.return_value = [SimpleNamespace(fournisseur_id=99)]
        service = JITService(Mock(), zone_dao)
        service._get_commandes_du_jour = Mock(return_value=[commande])

        with (
            patch("services.jit_service.resoudre_fournisseur_pour_commande", return_value=99),
            patch("services.jit_service.changer_statut") as changer_statut_mock,
        ):
            count = service.verrouiller_commandes(session, actor_id=1)

        self.assertEqual(count, 1)
        self.assertEqual(commande.fournisseur_id, 99)
        changer_statut_mock.assert_called_once()
        self.assertEqual(
            changer_statut_mock.call_args.kwargs["nouveau_statut"],
            "VERROUILLEE",
        )

    def test_commande_non_resolue_reste_non_verrouillee(self):
        commande = SimpleNamespace(id=8, client_id=42, statut="CONFIRMEE", fournisseur_id=None)
        session = Mock()
        zone_dao = Mock()
        zone_dao.get_zones_actives.return_value = []
        service = JITService(Mock(), zone_dao)
        service._get_commandes_du_jour = Mock(return_value=[commande])

        with (
            patch("services.jit_service.resoudre_fournisseur_pour_commande", return_value=None),
            patch("services.jit_service.changer_statut") as changer_statut_mock,
        ):
            count = service.verrouiller_commandes(session, actor_id=1)

        self.assertEqual(count, 0)
        self.assertIsNone(commande.fournisseur_id)
        changer_statut_mock.assert_not_called()


class SupplierNotificationTests(unittest.TestCase):
    def test_notification_outbox_par_fournisseur(self):
        session = Mock()
        zone = SimpleNamespace(id=3, nom_ville="fes", fournisseur_id=99)
        resultat = SimpleNamespace(
            nombre_commandes=2,
            details_produits=[
                SimpleNamespace(
                    product_id=10,
                    nom_fr="Tomates",
                    quantite_brute_kg=14.0,
                    unite="kg",
                )
            ],
        )

        notification = notifier_fournisseur(session, zone, resultat)

        self.assertIsNotNone(notification)
        self.assertEqual(notification.type, "WEBSOCKET")
        self.assertEqual(notification.payload["event"], "SUPPLIER_DAILY_BATCH")
        self.assertEqual(notification.payload["fournisseur_id"], 99)
        self.assertEqual(notification.payload["nombre_commandes"], 2)
        self.assertEqual(notification.payload["produits"][0]["quantite_kg"], 14.0)
        session.add.assert_called_once_with(notification)
        session.flush.assert_called_once()


if __name__ == "__main__":
    unittest.main()
