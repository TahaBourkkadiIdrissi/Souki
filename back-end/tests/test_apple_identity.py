"""Sign in with Apple : verification de l'identity token (signature, emetteur, destinataire, e-mail)."""

import time
import unittest
from unittest.mock import patch

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from jose import jwk, jwt

from services import apple_identity_service as apple

KID = "test-kid"


def _keypair():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    public_pem = private.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    public_jwk = jwk.construct(public_pem, algorithm="RS256").to_dict()
    public_jwk = {k: (v.decode() if isinstance(v, bytes) else v) for k, v in public_jwk.items()}
    public_jwk.update({"kid": KID, "use": "sig", "alg": "RS256"})
    return pem, public_jwk


PRIVATE_PEM, PUBLIC_JWK = _keypair()
OTHER_PEM, _ = _keypair()


def make_token(pem=PRIVATE_PEM, kid=KID, **overrides):
    now = int(time.time())
    claims = {
        "iss": "https://appleid.apple.com",
        "aud": "io.souki.app",
        "sub": "001234.abcd.5678",
        "email": "Client@PrivateRelay.AppleID.com",
        "email_verified": "true",
        "iat": now,
        "exp": now + 600,
    }
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, pem, algorithm="RS256", headers={"kid": kid})


@patch("services.apple_identity_service.APPLE_CLIENT_IDS", ("io.souki.app",))
@patch("services.apple_identity_service._fetch_apple_keys", return_value=[PUBLIC_JWK])
class AppleIdentityTests(unittest.TestCase):
    def test_jeton_valide(self, _keys):
        identity = apple.verify_apple_identity_token(make_token())
        self.assertEqual(identity, {"sub": "001234.abcd.5678", "email": "client@privaterelay.appleid.com"})

    def test_email_verified_booleen_accepte(self, _keys):
        self.assertIsNotNone(apple.verify_apple_identity_token(make_token(email_verified=True)))

    def test_mauvais_destinataire_refuse(self, _keys):
        self.assertIsNone(apple.verify_apple_identity_token(make_token(aud="com.autre.app")))

    def test_mauvais_emetteur_refuse(self, _keys):
        self.assertIsNone(apple.verify_apple_identity_token(make_token(iss="https://evil.example")))

    def test_jeton_expire_refuse(self, _keys):
        self.assertIsNone(apple.verify_apple_identity_token(make_token(exp=int(time.time()) - 60)))

    def test_signature_invalide_refusee(self, _keys):
        self.assertIsNone(apple.verify_apple_identity_token(make_token(pem=OTHER_PEM)))

    def test_cle_inconnue_refusee(self, _keys):
        self.assertIsNone(apple.verify_apple_identity_token(make_token(kid="inconnue")))

    def test_email_absent_ou_non_verifie_refuse(self, _keys):
        self.assertIsNone(apple.verify_apple_identity_token(make_token(email=None)))
        self.assertIsNone(apple.verify_apple_identity_token(make_token(email_verified="false")))

    def test_jeton_illisible_refuse(self, _keys):
        self.assertIsNone(apple.verify_apple_identity_token("pas-un-jwt"))


class AppleKeysUnavailableTests(unittest.TestCase):
    @patch("services.apple_identity_service.APPLE_CLIENT_IDS", ())
    def test_sans_configuration_503(self):
        with self.assertRaises(HTTPException) as context:
            apple.verify_apple_identity_token(make_token())
        self.assertEqual(context.exception.status_code, 503)

    @patch("services.apple_identity_service.requests.get", side_effect=apple.requests.ConnectionError("down"))
    def test_apple_injoignable_sans_cache_503(self, _get):
        apple._keys_cache.update({"keys": [], "fetched_at": 0.0})
        with self.assertRaises(HTTPException) as context:
            apple.verify_apple_identity_token(make_token())
        self.assertEqual(context.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
