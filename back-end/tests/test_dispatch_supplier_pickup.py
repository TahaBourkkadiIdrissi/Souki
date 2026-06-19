import unittest
from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from services.dispatch_service import DispatchService


def _address(latitude, longitude, *, is_default=True):
    return SimpleNamespace(
        latitude=latitude,
        longitude=longitude,
        is_default=is_default,
        street="Rue test",
        neighborhood="Quartier test",
        ville="Fès",
        details=None,
    )


def _commande(commande_id, fournisseur_id, latitude, longitude):
    user = SimpleNamespace(
        id=commande_id,
        email=f"client{commande_id}@test.local",
        phone=None,
        addresses=[_address(latitude, longitude)],
    )
    client = SimpleNamespace(user=user)
    return SimpleNamespace(
        id=commande_id,
        fournisseur_id=fournisseur_id,
        statut="VERROUILLEE",
        status_version=1,
        date_commande=datetime(2026, 6, 19, 10, commande_id),
        client=client,
        client_id=commande_id,
        panier=None,
        tournee_id=None,
        livreur_id=None,
        ordre_passage=None,
    )


def _livreur(livreur_id):
    return SimpleNamespace(user_id=livreur_id)


def _service(session=None):
    return DispatchService(
        commande_dao=MagicMock(),
        livreur_dao=MagicMock(),
        tournee_dao=MagicMock(),
        session=session or MagicMock(),
    )


class DispatchAllocationTests(unittest.TestCase):
    def test_allocation_proportionnelle_et_minimum_un(self):
        service = _service()
        groupes = {
            10: [_commande(i, 10, 34.0, -5.0) for i in range(1, 7)],
            20: [_commande(i, 20, 33.9, -5.5) for i in range(7, 10)],
            30: [_commande(10, 30, 33.6, -7.6)],
        }
        livreurs = [_livreur(i) for i in range(1, 6)]

        allocations, sans_livreur = service._allocate_livreurs_by_supplier(groupes, livreurs)

        self.assertEqual(sans_livreur, [])
        self.assertEqual(sum(len(items) for items in allocations.values()), 5)
        self.assertTrue(all(len(allocations[fournisseur_id]) >= 1 for fournisseur_id in groupes))
        self.assertGreaterEqual(len(allocations[10]), len(allocations[20]))
        self.assertGreaterEqual(len(allocations[20]), len(allocations[30]))

    def test_moins_de_livreurs_que_de_fournisseurs_priorise_la_charge(self):
        service = _service()
        groupes = {
            10: [_commande(i, 10, 34.0, -5.0) for i in range(1, 5)],
            20: [_commande(5, 20, 33.9, -5.5), _commande(6, 20, 33.9, -5.5)],
            30: [_commande(7, 30, 33.6, -7.6)],
        }

        allocations, sans_livreur = service._allocate_livreurs_by_supplier(
            groupes,
            [_livreur(1), _livreur(2)],
        )

        self.assertEqual(set(allocations), {10, 20})
        self.assertEqual(sans_livreur, [30])

    def test_aucun_livreur_place_tous_les_fournisseurs_en_alerte(self):
        service = _service()
        groupes = {
            10: [_commande(1, 10, 34.0, -5.0)],
            20: [_commande(2, 20, 33.9, -5.5)],
        }

        allocations, sans_livreur = service._allocate_livreurs_by_supplier(groupes, [])

        self.assertEqual(allocations, {})
        self.assertEqual(sans_livreur, [10, 20])


class DispatchRoutingTests(unittest.TestCase):
    def test_tri_plus_proche_voisin_depuis_le_pickup(self):
        service = _service()
        proche = _commande(1, 10, 34.001, -5.0)
        milieu = _commande(2, 10, 34.01, -5.0)
        loin = _commande(3, 10, 34.1, -5.0)

        result = service._sort_commandes_from_pickup(
            [loin, milieu, proche],
            pickup_lat=34.0,
            pickup_lng=-5.0,
        )

        self.assertEqual([commande.id for commande in result], [1, 2, 3])

    @patch("services.dispatch_service.process_end_of_day_returns", return_value=0)
    @patch("services.dispatch_service.changer_statut")
    def test_generation_groupe_par_fournisseur_et_pose_le_pickup(
        self,
        changer_statut_mock,
        _process_returns_mock,
    ):
        session = MagicMock()
        session.in_transaction.return_value = False
        service = _service(session)
        commandes = [
            _commande(1, 10, 34.01, -5.0),
            _commande(2, 10, 34.02, -5.0),
            _commande(3, 20, 33.90, -5.5),
            _commande(4, None, 33.60, -7.6),
        ]
        service.commande_dao.get_commandes_non_assignees.return_value = commandes
        service.livreur_dao.get_available_livreurs.return_value = [_livreur(101), _livreur(102)]

        fournisseurs = {
            10: SimpleNamespace(user_id=10, latitude=34.0, longitude=-5.0),
            20: SimpleNamespace(user_id=20, latitude=33.89, longitude=-5.5),
        }
        session.get.side_effect = lambda model, key: fournisseurs.get(key)
        tournee_counter = iter((1001, 1002))
        service.tournee_dao.create_tournee.side_effect = lambda *args, **kwargs: SimpleNamespace(
            id=next(tournee_counter)
        )

        def apply_status(*args, **kwargs):
            kwargs["commande"].statut = kwargs["nouveau_statut"]

        changer_statut_mock.side_effect = apply_status

        result = service.generate_daily_routes(date(2026, 6, 20))

        self.assertEqual(result["tournees_created"], 2)
        self.assertEqual(result["commandes_assigned"], 3)
        self.assertEqual(result["commandes_sans_fournisseur"], 1)
        self.assertEqual(result["fournisseurs_sans_livreur"], [])
        self.assertIsNone(commandes[3].tournee_id)
        self.assertEqual(commandes[3].statut, "VERROUILLEE")

        create_calls = service.tournee_dao.create_tournee.call_args_list
        self.assertEqual(
            {call.kwargs["fournisseur_id"] for call in create_calls},
            {10, 20},
        )
        for call in create_calls:
            fournisseur_id = call.kwargs["fournisseur_id"]
            fournisseur = fournisseurs[fournisseur_id]
            self.assertEqual(call.kwargs["pickup_lat"], fournisseur.latitude)
            self.assertEqual(call.kwargs["pickup_lng"], fournisseur.longitude)

        self.assertTrue(all(c.statut == "EN_ATTENTE_LIVREUR" for c in commandes[:3]))
        self.assertEqual(changer_statut_mock.call_count, 3)

    @patch("services.dispatch_service.process_end_of_day_returns", return_value=0)
    def test_fournisseur_sans_coordonnees_reste_en_backlog(self, _process_returns_mock):
        session = MagicMock()
        session.in_transaction.return_value = False
        service = _service(session)
        commande = _commande(1, 10, 34.01, -5.0)
        service.commande_dao.get_commandes_non_assignees.return_value = [commande]
        service.livreur_dao.get_available_livreurs.return_value = [_livreur(101)]
        session.get.return_value = SimpleNamespace(
            user_id=10,
            latitude=None,
            longitude=None,
        )

        result = service.generate_daily_routes(date(2026, 6, 20))

        self.assertEqual(result["commandes_assigned"], 0)
        self.assertEqual(result["commandes_sans_coordonnees_fournisseur"], 1)
        self.assertEqual(commande.statut, "VERROUILLEE")
        self.assertIsNone(commande.tournee_id)
        service.tournee_dao.create_tournee.assert_not_called()


class DispatchSerializationTests(unittest.TestCase):
    def test_serialize_tournee_contient_le_bloc_pickup(self):
        service = _service()
        fournisseur = SimpleNamespace(
            shop_name="Ferme Atlas",
            address="Route d'Imouzzer",
            ville="Fès",
            phone="0612345678",
        )
        livreur_user = SimpleNamespace(id=101, email=None, phone="0600000000")
        livreur = SimpleNamespace(
            user_id=101,
            user=livreur_user,
            vehicule="moto",
            disponible=True,
            note_moyenne=4.8,
        )
        tournee = SimpleNamespace(
            id=1001,
            date_tournee=date(2026, 6, 20),
            statut="PLANIFIEE",
            distance_totale_km=None,
            created_at=None,
            livreur=livreur,
            fournisseur_id=10,
            fournisseur=fournisseur,
            pickup_lat=34.0,
            pickup_lng=-5.0,
            commandes=[],
        )

        service.tournee_dao.get_tournees_with_details.return_value = [tournee]
        service._get_anomalies_non_resolues = MagicMock(return_value=[])

        details = service.get_tournees_details(date(2026, 6, 20))
        result = details["tournees"][0]

        self.assertEqual(
            result["pickup"],
            {
                "fournisseur_id": 10,
                "shop_name": "Ferme Atlas",
                "address": "Route d'Imouzzer",
                "ville": "Fès",
                "phone": "0612345678",
                "latitude": 34.0,
                "longitude": -5.0,
            },
        )


if __name__ == "__main__":
    unittest.main()
