"""RISK-009 : SSRF via l'endpoint d'abonnement Web Push.

Le backend fait une requete sortante vers l'URL fournie par le client. Une liste
noire ne suffit pas : un nom de domaine public peut resoudre vers une adresse
privee (rebinding DNS, `169-254-169-254.nip.io`). Les services de push de
navigateur etant en nombre fini, la validation est une liste BLANCHE.
"""

import unittest

from dto.push_dto import validate_push_endpoint


class PushEndpointAllowlistTests(unittest.TestCase):
    def test_services_de_push_legitimes_acceptes(self):
        for endpoint in (
            "https://fcm.googleapis.com/fcm/send/abc123",
            "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
            "https://web.push.apple.com/QLMNOP",
            "https://par02p.notify.windows.com/w/?token=AQ",
        ):
            self.assertEqual(validate_push_endpoint(endpoint), endpoint)

    def test_metadonnees_cloud_refusees(self):
        for endpoint in (
            "https://169.254.169.254/latest/meta-data/iam/security-credentials/",
            "https://metadata.google.internal/computeMetadata/v1/",
            "https://169-254-169-254.nip.io/latest/meta-data/",
        ):
            with self.assertRaises(ValueError):
                validate_push_endpoint(endpoint)

    def test_reseau_interne_refuse(self):
        for endpoint in (
            "https://localhost/x",
            "https://127.0.0.1/x",
            "https://10.0.0.5/x",
            "https://backend.internal/x",
        ):
            with self.assertRaises(ValueError):
                validate_push_endpoint(endpoint)

    def test_domaine_arbitraire_refuse(self):
        with self.assertRaises(ValueError):
            validate_push_endpoint("https://evil.example.com/collect")

    def test_suffixe_trompeur_refuse(self):
        """`fcm.googleapis.com.evil.com` ne doit pas passer pour un hote autorise."""
        with self.assertRaises(ValueError):
            validate_push_endpoint("https://fcm.googleapis.com.evil.com/x")

    def test_http_refuse(self):
        with self.assertRaises(ValueError):
            validate_push_endpoint("http://fcm.googleapis.com/fcm/send/abc")

    def test_endpoint_vide_ou_trop_long_refuse(self):
        with self.assertRaises(ValueError):
            validate_push_endpoint("")
        with self.assertRaises(ValueError):
            validate_push_endpoint("https://fcm.googleapis.com/" + "a" * 600)


if __name__ == "__main__":
    unittest.main()
