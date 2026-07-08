"""TAHA-03 (VULN-008) et TAHA-07 (RISK-001) : durcissement des uploads."""

import io
import unittest
from types import SimpleNamespace

from fastapi import HTTPException
from PIL import Image

from controllers.commande_controller import (
    ALLOWED_AUDIO_FORMATS,
    MAX_AUDIO_SIZE_BYTES,
    _read_audio_upload_limited,
    _validate_audio_upload,
)
from services.supabase_storage_service import (
    SupabaseStorageError,
    SupabaseStorageService,
)

WEBM_MAGIC = b"\x1aE\xdf\xa3" + b"\x00" * 64


class AudioUploadTests(unittest.TestCase):
    def test_fichier_trop_gros_renvoie_413_avant_lecture_complete(self):
        oversized = io.BytesIO(b"x" * (MAX_AUDIO_SIZE_BYTES + 1024 * 1024))
        upload = SimpleNamespace(file=oversized)

        with self.assertRaises(HTTPException) as ctx:
            _read_audio_upload_limited(upload)

        self.assertEqual(ctx.exception.status_code, 413)
        # La lecture s'est arretee a limite + 1 : le reste du flux n'a pas ete consomme.
        self.assertGreater(len(oversized.read()), 0)

    def test_fichier_sous_la_limite_est_lu_entierement(self):
        payload = b"RIFF" + b"a" * 100
        upload = SimpleNamespace(file=io.BytesIO(payload))
        self.assertEqual(_read_audio_upload_limited(upload), payload)

    def test_ogg_n_est_plus_accepte(self):
        self.assertNotIn("audio/ogg", ALLOWED_AUDIO_FORMATS)
        with self.assertRaises(HTTPException) as ctx:
            _validate_audio_upload(b"OggS" + b"\x00" * 64, "audio/ogg")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_webm_valide_est_accepte(self):
        self.assertEqual(_validate_audio_upload(WEBM_MAGIC, "audio/webm"), "audio/webm")

    def test_signature_reelle_prime_sur_le_mime_declare(self):
        # Un faux WebM declare comme tel mais sans signature valide est refuse.
        with self.assertRaises(HTTPException):
            _validate_audio_upload(b"PAS-UN-AUDIO" + b"\x00" * 32, "audio/webm")

    def test_taille_au_dela_de_la_limite_renvoie_413(self):
        with self.assertRaises(HTTPException) as ctx:
            _validate_audio_upload(b"x" * (MAX_AUDIO_SIZE_BYTES + 1), "audio/webm")
        self.assertEqual(ctx.exception.status_code, 413)


def _png_bytes():
    image = Image.new("RGB", (8, 8), color=(200, 30, 30))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class ImageReencodeTests(unittest.TestCase):
    def test_faux_jpeg_rejete(self):
        fake_jpeg = b"\xff\xd8\xff\xe0" + b"<script>alert(1)</script>" + b"\x00" * 32
        with self.assertRaises(SupabaseStorageError):
            SupabaseStorageService._reencode_image(fake_jpeg, {"JPEG", "PNG", "WEBP"})

    def test_html_deguise_rejete(self):
        with self.assertRaises(SupabaseStorageError):
            SupabaseStorageService._reencode_image(b"<html><body>hi</body></html>", {"JPEG"})

    def test_image_valide_reencodee_en_jpeg_sans_metadonnees(self):
        clean = SupabaseStorageService._reencode_image(_png_bytes(), {"JPEG", "PNG", "WEBP"})

        self.assertTrue(clean.startswith(b"\xff\xd8"), "sortie JPEG attendue")
        reloaded = Image.open(io.BytesIO(clean))
        self.assertEqual(reloaded.format, "JPEG")
        self.assertNotIn("exif", reloaded.info)

    def test_format_hors_liste_rejete(self):
        # PNG valide mais liste blanche restreinte a JPEG.
        with self.assertRaises(SupabaseStorageError):
            SupabaseStorageService._reencode_image(_png_bytes(), {"JPEG"})


if __name__ == "__main__":
    unittest.main()
