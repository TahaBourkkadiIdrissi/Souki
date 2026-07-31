"""RISK-007 : normalisation des chemins d'avatar (bucket prive + URLs signees).

`t_users.avatar_url` contenait des URLs publiques completes et contient desormais
des chemins d'objet. Le resolveur doit accepter les deux formats, sinon la
migration casse l'affichage des photos existantes.
"""

import unittest

from services.supabase_storage_service import SupabaseStorageService


class NormalizeAvatarPathTests(unittest.TestCase):
    def setUp(self):
        self.service = SupabaseStorageService()

    def test_chemin_nu_inchange(self):
        self.assertEqual(
            self.service.normalize_avatar_path("105/3627dca7.jpg"),
            "105/3627dca7.jpg",
        )

    def test_url_publique_legacy_reduite_au_chemin(self):
        url = (
            "https://reowdwijnmkjujcqqztx.supabase.co"
            "/storage/v1/object/public/avatars/105/profile.jpg"
        )
        self.assertEqual(self.service.normalize_avatar_path(url), "105/profile.jpg")

    def test_url_encodee_decodee(self):
        url = (
            "https://exemple.supabase.co"
            "/storage/v1/object/public/avatars/47/photo%20de%20profil.png"
        )
        self.assertEqual(
            self.service.normalize_avatar_path(url), "47/photo de profil.png"
        )

    def test_valeurs_vides(self):
        for valeur in (None, "", "   "):
            self.assertIsNone(self.service.normalize_avatar_path(valeur))

    def test_url_hors_bucket_avatars_rejetee(self):
        url = "https://exemple.supabase.co/storage/v1/object/public/products/3/x.jpg"
        self.assertIsNone(self.service.normalize_avatar_path(url))

    def test_slash_initial_retire(self):
        self.assertEqual(self.service.normalize_avatar_path("/105/a.jpg"), "105/a.jpg")


if __name__ == "__main__":
    unittest.main()
