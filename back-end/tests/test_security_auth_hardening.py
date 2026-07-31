"""VULN-013/014/015 : durcissement des routes d'authentification publiques.

- /auth/resend-otp n'est pas authentifie et prend un user_id brut : il ne doit
  plus se comporter comme un oracle d'existence de compte.
- /auth/register et /auth/resend-otp declenchent un envoi d'email facture : ils
  doivent etre bornes par IP, en amont de toute authentification.
- L'inscription ne doit pas permettre de s'attribuer un role operationnel.
"""

import unittest

from fastapi import HTTPException

from services.auth_service import SELF_ASSIGNABLE_ROLES, AuthService
from services.rate_limit_service import IpActionQuota, _MemoryBackend


class ResendOtpNonEnumerableTests(unittest.TestCase):
    def test_reponse_generique_ne_revele_pas_la_cible(self):
        response = AuthService._generic_resend_response("email")
        self.assertIsNone(response["verification_target"])
        self.assertFalse(response["is_verified"])

    def test_reponse_generique_est_stable(self):
        """Compte inconnu et canal absent doivent donner la meme forme."""
        inconnu = AuthService._generic_resend_response(None)
        connu = AuthService._generic_resend_response("email")
        self.assertEqual(sorted(inconnu.keys()), sorted(connu.keys()))
        self.assertEqual(inconnu["message"], connu["message"])

    def test_message_ne_confirme_pas_l_existence(self):
        message = AuthService._generic_resend_response()["message"].lower()
        self.assertIn("si ce compte existe", message)


class IpActionQuotaTests(unittest.TestCase):
    def setUp(self):
        self.quota = IpActionQuota(backend=_MemoryBackend())

    def test_sous_le_plafond_passe(self):
        for _ in range(3):
            self.quota.ensure_within_quota("register", "10.0.0.1", 3, 3600)

    def test_au_dela_du_plafond_leve_429(self):
        for _ in range(3):
            self.quota.ensure_within_quota("register", "10.0.0.1", 3, 3600)
        with self.assertRaises(HTTPException) as ctx:
            self.quota.ensure_within_quota("register", "10.0.0.1", 3, 3600)
        self.assertEqual(ctx.exception.status_code, 429)

    def test_ips_distinctes_ont_des_compteurs_distincts(self):
        for _ in range(3):
            self.quota.ensure_within_quota("register", "10.0.0.1", 3, 3600)
        self.quota.ensure_within_quota("register", "10.0.0.2", 3, 3600)

    def test_actions_distinctes_ont_des_compteurs_distincts(self):
        for _ in range(3):
            self.quota.ensure_within_quota("register", "10.0.0.1", 3, 3600)
        self.quota.ensure_within_quota("resend-otp", "10.0.0.1", 3, 3600)

    def test_ip_absente_est_comptee_comme_un_seau_unique(self):
        for _ in range(3):
            self.quota.ensure_within_quota("register", None, 3, 3600)
        with self.assertRaises(HTTPException):
            self.quota.ensure_within_quota("register", None, 3, 3600)


class SelfAssignableRolesTests(unittest.TestCase):
    def test_roles_operationnels_non_auto_attribuables(self):
        for role in ("ADMIN", "LIVREUR", "FOURNISSEUR", "ADMIN_SUPER"):
            self.assertNotIn(role, SELF_ASSIGNABLE_ROLES)

    def test_roles_front_office_auto_attribuables(self):
        self.assertEqual(SELF_ASSIGNABLE_ROLES, {"CLIENT", "PARENT"})


if __name__ == "__main__":
    unittest.main()
