import unittest
import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from dto.livreur_dto import DeliveryEventRequestDTO, DeliveryTargetStatus
from services.livreur_service import LivreurService


def _service(session=None):
    return LivreurService(
        livreur_dao=MagicMock(),
        client_blacklist_service=MagicMock(),
        session=session or MagicMock(),
        dispatch_service=MagicMock(),
    )


def _tournee_query(tournee):
    query = MagicMock()
    query.options.return_value = query
    query.filter.return_value = query
    query.with_for_update.return_value = query
    query.first.return_value = tournee
    return query


def _commande(commande_id=1, statut="EN_ATTENTE_LIVREUR", ramasse_at=None):
    tournee = SimpleNamespace(id=10, ramasse_at=ramasse_at)
    return SimpleNamespace(
        id=commande_id,
        statut=statut,
        status_version=1,
        mode_paiement="WALLET",
        montant_total=100,
        livreur_id=101,
        client_id=201,
        tournee=tournee,
        enroute_at=None,
        delivered_at=None,
        absent_at=None,
    )


class RamassageServiceTests(unittest.TestCase):
    @patch("services.livreur_service.today_morocco", return_value=date(2026, 6, 20))
    def test_get_tournee_expose_pickup_et_ramassage(self, _today_mock):
        service = _service()
        timestamp = datetime(2026, 6, 20, 8, 0, tzinfo=timezone.utc)
        service.livreur_dao.get_tournee_rows.return_value = [
            {
                "commande_id": 1,
                "ordre_passage": 1,
                "tournee_id": 10,
                "date_tournee": date(2026, 6, 20),
                "ramasse_at": timestamp,
                "fournisseur_id": 20,
                "pickup_lat": 34.0,
                "pickup_lng": -5.0,
                "pickup_shop_name": "Ferme Atlas",
                "pickup_address": "Route d'Imouzzer",
                "pickup_ville": "Fès",
                "pickup_phone": "0612345678",
                "client_phone": "0600000000",
                "street": "Rue test",
                "neighborhood": "Centre",
                "details": None,
                "colis_count": 1,
                "creneau_livraison": "09h-11h",
                "statut": "A_LIVRER",
                "status_version": 2,
                "montant_total": 100,
                "mode_paiement": "WALLET",
                "payment_validated": True,
                "lat": 34.01,
                "lng": -5.01,
            }
        ]

        result = service.get_tournee(101)

        self.assertEqual(result.tournee_id, 10)
        self.assertTrue(result.ramassee)
        self.assertEqual(result.ramasse_at, timestamp)
        self.assertEqual(result.pickup.shop_name, "Ferme Atlas")
        self.assertEqual(result.pickup.latitude, 34.0)
        self.assertEqual(result.items[0].ordre_passage, 1)
        call = service.livreur_dao.get_tournee_rows.call_args.kwargs
        self.assertEqual(call["target_date"], date(2026, 6, 20))
        self.assertEqual(
            set(call["visible_statuses"]),
            {"EN_ATTENTE_LIVREUR", "A_LIVRER", "EN_ROUTE"},
        )

    @patch("services.livreur_service.today_morocco", return_value=date(2026, 6, 20))
    @patch("services.livreur_service.changer_statut")
    def test_ramassage_pose_horodatage_et_passe_les_commandes_a_livrer(
        self,
        changer_statut_mock,
        _today_mock,
    ):
        session = MagicMock()
        commandes = [_commande(1), _commande(2), _commande(3, statut="A_LIVRER")]
        tournee = SimpleNamespace(
            id=10,
            livreur_id=101,
            date_tournee=date(2026, 6, 20),
            ramasse_at=None,
            statut="PLANIFIEE",
            commandes=commandes,
        )
        session.query.return_value = _tournee_query(tournee)
        service = _service(session)

        result = service.confirmer_ramassage(101, 10)

        self.assertIsNotNone(tournee.ramasse_at)
        self.assertEqual(tournee.statut, "EN_COURS")
        self.assertEqual(result.commandes_ramassees, 2)
        self.assertFalse(result.idempotent)
        self.assertEqual(changer_statut_mock.call_count, 2)
        for call in changer_statut_mock.call_args_list:
            self.assertEqual(call.kwargs["nouveau_statut"], "A_LIVRER")
            self.assertEqual(call.kwargs["reason"], "RAMASSAGE_FOURNISSEUR")
        session.commit.assert_called_once()

    @patch("services.livreur_service.today_morocco", return_value=date(2026, 6, 20))
    @patch("services.livreur_service.changer_statut")
    def test_ramassage_idempotent_ne_refait_aucune_transition(
        self,
        changer_statut_mock,
        _today_mock,
    ):
        session = MagicMock()
        timestamp = datetime(2026, 6, 20, 8, 0, tzinfo=timezone.utc)
        tournee = SimpleNamespace(
            id=10,
            livreur_id=101,
            date_tournee=date(2026, 6, 20),
            ramasse_at=timestamp,
            statut="EN_COURS",
            commandes=[_commande()],
        )
        session.query.return_value = _tournee_query(tournee)

        result = _service(session).confirmer_ramassage(101, 10)

        self.assertTrue(result.idempotent)
        self.assertEqual(result.commandes_ramassees, 0)
        changer_statut_mock.assert_not_called()
        session.commit.assert_called_once()

    @patch("services.livreur_service.today_morocco", return_value=date(2026, 6, 20))
    def test_ramassage_tournee_autre_livreur_refuse(self, _today_mock):
        session = MagicMock()
        tournee = SimpleNamespace(
            id=10,
            livreur_id=999,
            date_tournee=date(2026, 6, 20),
            ramasse_at=None,
            commandes=[],
        )
        session.query.return_value = _tournee_query(tournee)

        with self.assertRaises(HTTPException) as context:
            _service(session).confirmer_ramassage(101, 10)

        self.assertEqual(context.exception.status_code, 403)

    @patch("services.livreur_service.today_morocco", return_value=date(2026, 6, 20))
    def test_ramassage_tournee_autre_jour_refuse(self, _today_mock):
        session = MagicMock()
        tournee = SimpleNamespace(
            id=10,
            livreur_id=101,
            date_tournee=date(2026, 6, 19),
            ramasse_at=None,
            commandes=[],
        )
        session.query.return_value = _tournee_query(tournee)

        with self.assertRaises(HTTPException) as context:
            _service(session).confirmer_ramassage(101, 10)

        self.assertEqual(context.exception.status_code, 409)


class DeliveryPickupGuardTests(unittest.TestCase):
    def _payload(self):
        return DeliveryEventRequestDTO(
            target_status=DeliveryTargetStatus.EN_ROUTE,
            client_event_id=uuid.uuid4(),
            device_timestamp=datetime.now(timezone.utc),
            expected_version=1,
        )

    def test_en_route_refuse_avant_ramassage(self):
        session = MagicMock()
        service = _service(session)
        commande = _commande(statut="A_LIVRER", ramasse_at=None)
        service.livreur_dao.get_delivery_event_by_client_event_id.return_value = None
        service.livreur_dao.get_commande_delivery_context.return_value = {
            "commande": commande,
            "client_phone": None,
            "payment_validated": True,
        }

        with self.assertRaises(HTTPException) as context:
            service.apply_delivery_event(101, 1, self._payload())

        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(context.exception.detail, "Ramassez d'abord chez le fournisseur.")

    @patch("services.livreur_service.changer_statut")
    def test_en_route_autorise_apres_ramassage(self, changer_statut_mock):
        session = MagicMock()
        service = _service(session)
        commande = _commande(
            statut="A_LIVRER",
            ramasse_at=datetime.now(timezone.utc),
        )
        event = SimpleNamespace(
            id=uuid.uuid4(),
            client_event_id=uuid.uuid4(),
            commande_id=1,
            previous_status="A_LIVRER",
            new_status="EN_ROUTE",
            device_timestamp=datetime.now(timezone.utc),
            server_timestamp=datetime.now(timezone.utc),
        )
        payload = DeliveryEventRequestDTO(
            target_status=DeliveryTargetStatus.EN_ROUTE,
            client_event_id=event.client_event_id,
            device_timestamp=event.device_timestamp,
            expected_version=1,
        )
        service.livreur_dao.get_delivery_event_by_client_event_id.side_effect = [None, event]
        service.livreur_dao.get_commande_delivery_context.return_value = {
            "commande": commande,
            "client_phone": None,
            "payment_validated": True,
        }

        def apply_status(*args, **kwargs):
            kwargs["commande"].statut = kwargs["nouveau_statut"]
            kwargs["commande"].status_version = 2

        changer_statut_mock.side_effect = apply_status

        result = service.apply_delivery_event(101, 1, payload)

        self.assertEqual(result.new_status, "EN_ROUTE")
        changer_statut_mock.assert_called_once()
        session.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
