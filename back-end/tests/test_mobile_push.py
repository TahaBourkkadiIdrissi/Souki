"""Notifications push des apps mobiles (jeton Expo) : validation, envoi, fan-out."""

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from pydantic import ValidationError

from dto.push_dto import MobilePushDeviceDTO
from services import expo_push_service as expo_module
from services.delivery_outbox_worker import DeliveryOutboxWorker, NotificationSkipped
from services.expo_push_service import (
    ANDROID_CHANNEL_ACCOUNT,
    ANDROID_CHANNEL_NEWS,
    ANDROID_CHANNEL_ORDERS,
    ExpoPushError,
    ExpoPushResult,
    ExpoPushService,
    android_channel_for,
    is_valid_expo_token,
)
from services.notification_catalog import CHANNEL_PUSH

TOKEN = "ExponentPushToken[abcdefghij1234567890]"
OTHER_TOKEN = "ExponentPushToken[zyxwvutsrq0987654321]"


class ExpoTokenValidationTests(unittest.TestCase):
    def test_jetons_expo_acceptes(self):
        self.assertTrue(is_valid_expo_token(TOKEN))
        self.assertTrue(is_valid_expo_token("ExpoPushToken[abcdefghij1234567890]"))

    def test_jetons_invalides_refuses(self):
        for token in ("", "abc", "https://exp.host/x", "ExponentPushToken[<script>]", "ExponentPushToken[]"):
            with self.subTest(token=token):
                self.assertFalse(is_valid_expo_token(token))

    def test_dto_normalise_la_plateforme(self):
        dto = MobilePushDeviceDTO(token=TOKEN, plateforme="Android")
        self.assertEqual(dto.plateforme, "android")

    def test_dto_refuse_plateforme_inconnue(self):
        with self.assertRaises(ValidationError):
            MobilePushDeviceDTO(token=TOKEN, plateforme="windows")

    def test_dto_refuse_jeton_invalide(self):
        with self.assertRaises(ValidationError):
            MobilePushDeviceDTO(token="pas-un-jeton-expo", plateforme="android")


class AndroidChannelTests(unittest.TestCase):
    def test_canal_selon_la_categorie(self):
        self.assertEqual(android_channel_for("order_updates"), ANDROID_CHANNEL_ORDERS)
        self.assertEqual(android_channel_for("livraison"), ANDROID_CHANNEL_ORDERS)
        self.assertEqual(android_channel_for("promotions"), ANDROID_CHANNEL_NEWS)
        self.assertEqual(android_channel_for(None), ANDROID_CHANNEL_ACCOUNT)


def _response(status_code=200, tickets=None):
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = {"data": tickets or []}
    return response


class ExpoPushServiceTests(unittest.TestCase):
    def setUp(self):
        self.service = ExpoPushService()

    def test_envoi_ok_et_appareil_desinstalle(self):
        tickets = [
            {"status": "ok", "id": "1"},
            {"status": "error", "details": {"error": "DeviceNotRegistered"}},
        ]
        with patch.object(expo_module.requests, "post", return_value=_response(tickets=tickets)) as post:
            result = self.service.send(
                tokens=[TOKEN, OTHER_TOKEN],
                payload={"title": "Commande", "body": "En route", "url": "/suivi-commande?commande=7"},
                channel_id=ANDROID_CHANNEL_ORDERS,
            )

        self.assertEqual(result.delivered, 1)
        self.assertEqual(result.gone_tokens, [OTHER_TOKEN])
        sent = post.call_args.kwargs["json"]
        self.assertEqual(sent[0]["channelId"], ANDROID_CHANNEL_ORDERS)
        self.assertEqual(sent[0]["data"]["url"], "/suivi-commande?commande=7")
        self.assertEqual(post.call_args.args[0], expo_module.EXPO_PUSH_URL)

    def test_erreur_serveur_est_temporaire(self):
        with patch.object(expo_module.requests, "post", return_value=_response(status_code=503)):
            with self.assertRaises(ExpoPushError):
                self.service.send(tokens=[TOKEN], payload={}, channel_id=ANDROID_CHANNEL_ORDERS)

    def test_jeton_invalide_jamais_envoye(self):
        with patch.object(expo_module.requests, "post") as post:
            result = self.service.send(tokens=["invalide"], payload={}, channel_id=ANDROID_CHANNEL_ORDERS)
        post.assert_not_called()
        self.assertEqual(result.delivered, 0)


class OutboxMobilePushTests(unittest.TestCase):
    def _worker(self, devices, result=None, error=None):
        web_dao = MagicMock()
        web_dao.get_active_subscriptions.return_value = []
        mobile_dao = MagicMock()
        mobile_dao.get_active_devices.return_value = devices
        push = MagicMock()
        if error is not None:
            push.send.side_effect = error
        else:
            push.send.return_value = result
        worker = DeliveryOutboxWorker(push_subscription_dao=web_dao, mobile_device_dao=mobile_dao, mobile_push_service=push)
        return worker, mobile_dao, push

    @staticmethod
    def _entry():
        return SimpleNamespace(id=1, type=CHANNEL_PUSH, user_id=42, dedupe_key=None)

    def test_livre_sur_l_app_sans_cles_vapid(self):
        worker, mobile_dao, push = self._worker(
            [SimpleNamespace(token=TOKEN)], result=ExpoPushResult(delivered=1, gone_tokens=[], errors=[])
        )
        with patch("services.delivery_outbox_worker.web_push_service") as web:
            web.is_configured.return_value = False
            worker._deliver_push(MagicMock(), self._entry(), {"user_id": 42, "category": "livraison", "title": "T"})

        self.assertEqual(push.send.call_args.kwargs["channel_id"], ANDROID_CHANNEL_ORDERS)
        mobile_dao.revoke_by_token.assert_not_called()

    def test_appareil_desinstalle_revoque(self):
        worker, mobile_dao, _push = self._worker(
            [SimpleNamespace(token=TOKEN)], result=ExpoPushResult(delivered=0, gone_tokens=[TOKEN], errors=[])
        )
        with patch("services.delivery_outbox_worker.web_push_service") as web:
            web.is_configured.return_value = False
            with self.assertRaises(NotificationSkipped):
                worker._deliver_push(MagicMock(), self._entry(), {"user_id": 42})

        mobile_dao.revoke_by_token.assert_called_once()

    def test_panne_expo_reprogrammee(self):
        worker, _mobile_dao, _push = self._worker([SimpleNamespace(token=TOKEN)], error=ExpoPushError("503"))
        with patch("services.delivery_outbox_worker.web_push_service") as web:
            web.is_configured.return_value = False
            with self.assertRaises(RuntimeError):
                worker._deliver_push(MagicMock(), self._entry(), {"user_id": 42})

    def test_aucun_appareil_ignore(self):
        worker, _mobile_dao, push = self._worker([])
        with patch("services.delivery_outbox_worker.web_push_service") as web:
            web.is_configured.return_value = False
            with self.assertRaises(NotificationSkipped):
                worker._deliver_push(MagicMock(), self._entry(), {"user_id": 42})
        push.send.assert_not_called()


if __name__ == "__main__":
    unittest.main()
