"""Notifications multi-canal : respect des preferences, idempotence, reprise.

Aucun acces base : la session est un double qui enregistre les entrees outbox.
"""

import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from dto.push_dto import validate_push_endpoint
from services import notification_service as notification_module
from services.delivery_outbox_worker import (
    BACKOFF_SECONDS,
    MAX_ATTEMPTS,
    DeliveryOutboxWorker,
    NotificationSkipped,
)
from services.notification_catalog import CHANNEL_EMAIL, CHANNEL_PUSH
from services.notification_service import NotificationService

CLIENT_ID = 42
CLIENT_EMAIL = "client@example.ma"
CLIENT_PHONE = "+212612345678"


def _preferences(**overrides):
    values = {
        "email": True,
        "push": True,
        "promotions": True,
        "order_updates": True,
        "newsletter": True,
        "livraison": True,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class FakeSession:
    """Double de session SQLAlchemy limite a ce qu'utilise le fan-out."""

    def __init__(self, user=None, preferences=None):
        self.user = user or SimpleNamespace(
            id=CLIENT_ID, email=CLIENT_EMAIL, phone=CLIENT_PHONE, is_active=True
        )
        self.preferences = preferences
        self.added = []

    def get(self, _entity, _identifier):
        return self.user

    def query(self, _entity):
        return self

    def filter(self, *_args):
        return self

    def first(self):
        return self.preferences

    @contextmanager
    def begin_nested(self):
        yield self

    def add(self, entry):
        self.added.append(entry)

    def flush(self):
        return None

    def channels(self):
        return [entry.type for entry in self.added]


def _service(active_push_subscriptions=1):
    dao = MagicMock()
    dao.count_active_subscriptions.return_value = active_push_subscriptions
    return NotificationService(push_subscription_dao=dao)


class NotificationPreferencesTests(unittest.TestCase):
    """Les canaux mis en file suivent strictement /api/user/notifications."""

    def test_tous_les_canaux_actifs_produisent_une_entree_par_canal(self):
        session = FakeSession(preferences=_preferences())

        channels = _service().notify(
            session, user_id=CLIENT_ID, event_key="ORDER_CONFIRMED", data={"commande_id": 7}
        )

        self.assertEqual(sorted(channels), sorted([CHANNEL_PUSH, CHANNEL_EMAIL]))
        self.assertEqual(sorted(session.channels()), sorted([CHANNEL_PUSH, CHANNEL_EMAIL]))

    def test_canal_desactive_est_ignore(self):
        session = FakeSession(preferences=_preferences(email=False))

        channels = _service().notify(
            session, user_id=CLIENT_ID, event_key="ORDER_CONFIRMED", data={"commande_id": 7}
        )

        self.assertEqual(channels, [CHANNEL_PUSH])

    def test_categorie_desactivee_bloque_tous_les_canaux(self):
        session = FakeSession(preferences=_preferences(livraison=False))

        channels = _service().notify(
            session, user_id=CLIENT_ID, event_key="ORDER_OUT_FOR_DELIVERY", data={"commande_id": 7}
        )

        self.assertEqual(channels, [])
        self.assertEqual(session.added, [])

    def test_preferences_absentes_utilisent_les_defauts(self):
        # Defauts : email + push actifs.
        session = FakeSession(preferences=None)

        channels = _service().notify(
            session, user_id=CLIENT_ID, event_key="ORDER_OUT_FOR_DELIVERY", data={"commande_id": 7}
        )

        self.assertEqual(channels, [CHANNEL_PUSH])

    def test_sans_appareil_abonne_le_push_est_ignore(self):
        session = FakeSession(preferences=_preferences())

        channels = _service(active_push_subscriptions=0).notify(
            session, user_id=CLIENT_ID, event_key="ORDER_CONFIRMED", data={"commande_id": 7}
        )

        self.assertEqual(channels, [CHANNEL_EMAIL])

    def test_sans_email_le_canal_email_est_ignore(self):
        session = FakeSession(
            user=SimpleNamespace(id=CLIENT_ID, email=None, phone=CLIENT_PHONE, is_active=True),
            preferences=_preferences(),
        )

        channels = _service().notify(
            session, user_id=CLIENT_ID, event_key="ORDER_CONFIRMED", data={"commande_id": 7}
        )

        self.assertEqual(channels, [CHANNEL_PUSH])

    def test_evenement_inconnu_ne_leve_pas(self):
        session = FakeSession(preferences=_preferences())

        self.assertEqual(_service().notify(session, user_id=CLIENT_ID, event_key="INEXISTANT"), [])

    def test_echec_interne_ne_remonte_jamais_dans_le_flux_metier(self):
        session = MagicMock()
        session.get.side_effect = RuntimeError("base indisponible")

        self.assertEqual(_service().notify(session, user_id=CLIENT_ID, event_key="ORDER_CONFIRMED"), [])


class NotificationStatusRoutingTests(unittest.TestCase):

    def test_statut_interne_ne_notifie_pas_le_client(self):
        session = FakeSession(preferences=_preferences())

        channels = _service().notify_order_status(
            session, client_id=CLIENT_ID, commande_id=7, new_status="EN_ATTENTE_LIVREUR"
        )

        self.assertEqual(channels, [])

    def test_statut_livre_notifie_le_client(self):
        session = FakeSession(preferences=_preferences())

        channels = _service().notify_order_status(
            session, client_id=CLIENT_ID, commande_id=7, new_status="LIVRE"
        )

        self.assertEqual(sorted(channels), sorted([CHANNEL_PUSH, CHANNEL_EMAIL]))

    def test_commande_sans_client_ne_notifie_pas(self):
        session = FakeSession(preferences=_preferences())

        channels = _service().notify_order_status(
            session, client_id=None, commande_id=7, new_status="LIVRE"
        )

        self.assertEqual(channels, [])

    def test_cle_didempotence_par_canal_et_par_occurrence(self):
        session = FakeSession(preferences=_preferences())

        _service().notify_order_status(
            session, client_id=CLIENT_ID, commande_id=7, new_status="LIVRE", dedupe_suffix="LIVRE:3"
        )

        keys = {entry.dedupe_key for entry in session.added}
        self.assertEqual(
            keys,
            {
                f"ORDER_DELIVERED:{CLIENT_ID}:{CHANNEL_PUSH}:LIVRE:3",
                f"ORDER_DELIVERED:{CLIENT_ID}:{CHANNEL_EMAIL}:LIVRE:3",
            },
        )


class QuietHoursTests(unittest.TestCase):
    """Le push marketing ne reveille personne la nuit."""

    @staticmethod
    def _at(hour):
        # 00:00 UTC == 01:00 heure marocaine (UTC+1, sans heure d'ete).
        return datetime(2026, 7, 22, hour, 0, tzinfo=notification_module.MOROCCO_TIMEZONE).astimezone(
            timezone.utc
        )

    def test_marketing_de_nuit_est_reporte_a_la_reprise(self):
        deferred = notification_module._defer_past_quiet_hours(self._at(23))
        local = deferred.astimezone(notification_module.MOROCCO_TIMEZONE)

        self.assertEqual(local.hour, notification_module.QUIET_HOURS_END)
        self.assertEqual(local.day, 23)

    def test_marketing_petit_matin_est_reporte_au_meme_jour(self):
        deferred = notification_module._defer_past_quiet_hours(self._at(6))
        local = deferred.astimezone(notification_module.MOROCCO_TIMEZONE)

        self.assertEqual(local.hour, notification_module.QUIET_HOURS_END)
        self.assertEqual(local.day, 22)

    def test_journee_nest_pas_reportee(self):
        moment = self._at(14)

        self.assertEqual(notification_module._defer_past_quiet_hours(moment), moment)

    def test_email_transactionnel_part_immediatement_meme_la_nuit(self):
        session = FakeSession(preferences=_preferences())

        _service().notify(session, user_id=CLIENT_ID, event_key="ORDER_CONFIRMED", data={"commande_id": 7})

        email_entry = next(entry for entry in session.added if entry.type == CHANNEL_EMAIL)
        self.assertLessEqual(
            email_entry.next_attempt_at, datetime.now(timezone.utc) + timedelta(seconds=1)
        )


class OutboxWorkerRetryTests(unittest.TestCase):

    def setUp(self):
        self.worker = DeliveryOutboxWorker()

    @staticmethod
    def _entry(attempts=0):
        return SimpleNamespace(
            id=1,
            type=CHANNEL_PUSH,
            event="ORDER_ABSENT",
            attempts=attempts,
            status="PENDING",
            last_error=None,
            next_attempt_at=None,
        )

    def test_premier_echec_reprogramme_avec_le_premier_delai(self):
        entry = self._entry()

        self.worker._schedule_retry(entry, RuntimeError("fournisseur injoignable"))

        self.assertEqual(entry.status, "PENDING")
        self.assertEqual(entry.attempts, 1)
        self.assertAlmostEqual(
            (entry.next_attempt_at - datetime.now(timezone.utc)).total_seconds(),
            BACKOFF_SECONDS[0],
            delta=5,
        )

    def test_les_delais_croissent(self):
        delays = []
        entry = self._entry()
        for _ in range(3):
            self.worker._schedule_retry(entry, RuntimeError("echec"))
            delays.append((entry.next_attempt_at - datetime.now(timezone.utc)).total_seconds())

        self.assertEqual(delays, sorted(delays))

    def test_abandon_apres_le_nombre_maximal_de_tentatives(self):
        entry = self._entry(attempts=MAX_ATTEMPTS - 1)

        self.worker._schedule_retry(entry, RuntimeError("echec definitif"))

        self.assertEqual(entry.status, "FAILED")
        self.assertIn("echec definitif", entry.last_error)

    def test_canal_non_deliverable_est_ignore(self):
        # Les lignes WEBSOCKET (temps reel back-office) et vestiges SMS ne sont
        # pas l'affaire de ce worker : ignorees, sans journaliser le destinataire.
        entry = SimpleNamespace(type="WEBSOCKET", payload={"recipient": "0600000000"})

        with self.assertRaises(NotificationSkipped):
            self.worker._dispatch(MagicMock(), entry)

    def test_push_sans_abonnement_est_ignore_sans_retry(self):
        dao = MagicMock()
        dao.get_active_subscriptions.return_value = []
        worker = DeliveryOutboxWorker(push_subscription_dao=dao)
        entry = SimpleNamespace(id=1, type=CHANNEL_PUSH, user_id=CLIENT_ID, dedupe_key=None)

        with self.assertRaises(NotificationSkipped):
            worker._deliver_push(MagicMock(), entry, {"user_id": CLIENT_ID})


class PushEndpointValidationTests(unittest.TestCase):
    """Le backend appelle cet endpoint : il ne doit jamais viser le reseau interne."""

    def test_endpoint_navigateur_valide(self):
        endpoint = "https://fcm.googleapis.com/fcm/send/abc123"

        self.assertEqual(validate_push_endpoint(endpoint), endpoint)

    def test_http_refuse(self):
        with self.assertRaises(ValueError):
            validate_push_endpoint("http://fcm.googleapis.com/fcm/send/abc")

    def test_localhost_refuse(self):
        with self.assertRaises(ValueError):
            validate_push_endpoint("https://localhost/push")

    def test_ip_litterale_refusee(self):
        for host in ("169.254.169.254", "127.0.0.1", "10.0.0.5", "8.8.8.8"):
            with self.subTest(host=host):
                with self.assertRaises(ValueError):
                    validate_push_endpoint(f"https://{host}/push")

    def test_domaine_interne_refuse(self):
        with self.assertRaises(ValueError):
            validate_push_endpoint("https://redis.internal/push")

    def test_endpoint_trop_long_refuse(self):
        with self.assertRaises(ValueError):
            validate_push_endpoint("https://fcm.googleapis.com/" + "a" * 600)


if __name__ == "__main__":
    unittest.main()
