"""Photo de reclamation (B5) : nettoyage de l'image, proprietaire, delai, une seule photo."""

import io
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from fastapi import HTTPException
from PIL import Image

from services.claim_photo_service import CLAIM_PHOTO_WINDOW, ClaimPhotoService, claim_photo_path
from services.claim_photo_storage_service import (
    CLAIM_PHOTO_MAX_SIDE,
    MAX_CLAIM_PHOTO_UPLOAD_BYTES,
    ClaimPhotoError,
    ClaimPhotoExistsError,
    ClaimPhotoTooLargeError,
    sanitize_claim_photo,
)


def image_bytes(fmt="JPEG", size=(800, 600), exif_gps=False):
    image = Image.new("RGB", size, (200, 40, 40))
    output = io.BytesIO()
    if exif_gps:
        exif = Image.Exif()
        exif[0x8825] = {1: "N", 2: (34.0, 2.0, 0.0)}  # GPSInfo
        exif[0x010F] = "Apple"  # Make
        image.save(output, format=fmt, exif=exif)
    else:
        image.save(output, format=fmt)
    return output.getvalue()


class SanitizeClaimPhotoTests(unittest.TestCase):
    def test_real_photo_is_reencoded_as_jpeg(self):
        clean = sanitize_claim_photo(image_bytes("PNG"))
        self.assertEqual(Image.open(io.BytesIO(clean)).format, "JPEG")

    def test_exif_and_gps_are_removed(self):
        clean = sanitize_claim_photo(image_bytes(exif_gps=True))
        self.assertEqual(len(Image.open(io.BytesIO(clean)).getexif()), 0)

    def test_large_photo_is_reduced(self):
        clean = sanitize_claim_photo(image_bytes(size=(4000, 3000)))
        self.assertLessEqual(max(Image.open(io.BytesIO(clean)).size), CLAIM_PHOTO_MAX_SIDE)

    def test_fake_image_is_refused(self):
        with self.assertRaises(ClaimPhotoError):
            sanitize_claim_photo(b"<html><script>alert(1)</script></html>" + b"0" * 200)

    def test_script_disguised_behind_jpeg_header_is_refused(self):
        with self.assertRaises(ClaimPhotoError):
            sanitize_claim_photo(b"\xff\xd8\xff\xe0" + b"<?php system($_GET['c']); ?>" * 20)

    def test_gif_is_refused(self):
        with self.assertRaises(ClaimPhotoError):
            sanitize_claim_photo(image_bytes("GIF"))

    def test_decompression_bomb_is_refused_before_decoding(self):
        # 10 000 x 10 000 = 100 megapixels, tres leger une fois compresse.
        with self.assertRaises(ClaimPhotoError):
            sanitize_claim_photo(image_bytes("PNG", size=(10000, 10000)))

    def test_truncated_file_is_refused(self):
        with self.assertRaises(ClaimPhotoError):
            sanitize_claim_photo(image_bytes()[:300])

    def test_too_heavy_is_refused_without_decoding(self):
        with self.assertRaises(ClaimPhotoTooLargeError):
            sanitize_claim_photo(b"\xff" * (MAX_CLAIM_PHOTO_UPLOAD_BYTES + 1))

    def test_empty_is_refused(self):
        with self.assertRaises(ClaimPhotoError):
            sanitize_claim_photo(b"")


class ClaimPhotoServiceTests(unittest.TestCase):
    def setUp(self):
        self.dao = MagicMock()
        self.storage = MagicMock()
        self.session = MagicMock()
        self.service = ClaimPhotoService(self.dao, self.storage, self.session)
        self.claim = SimpleNamespace(id=55, commande_id=2041, created_at=datetime.now(timezone.utc) - timedelta(minutes=3))

    def test_photo_is_stored_under_a_server_name(self):
        self.dao.get_latest_user_claim_for_line.return_value = self.claim

        result = self.service.attach_photo(7, 2041, 900, image_bytes())

        self.assertEqual(result.status, "success")
        self.dao.get_latest_user_claim_for_line.assert_called_once_with(self.session, 7, 2041, 900)
        path, content = self.storage.upload.call_args.args
        self.assertEqual(path, "2041/55.jpg")
        self.assertEqual(Image.open(io.BytesIO(content)).format, "JPEG")
        self.session.commit.assert_not_called()

    def test_claim_of_another_client_is_not_found(self):
        self.dao.get_latest_user_claim_for_line.return_value = None

        with self.assertRaises(HTTPException) as raised:
            self.service.attach_photo(7, 2041, 900, image_bytes())

        self.assertEqual(raised.exception.status_code, 404)
        self.storage.upload.assert_not_called()

    def test_too_late_is_refused(self):
        self.claim.created_at = datetime.now(timezone.utc) - CLAIM_PHOTO_WINDOW - timedelta(minutes=1)
        self.dao.get_latest_user_claim_for_line.return_value = self.claim

        with self.assertRaises(HTTPException) as raised:
            self.service.attach_photo(7, 2041, 900, image_bytes())

        self.assertEqual(raised.exception.status_code, 409)
        self.storage.upload.assert_not_called()

    def test_invalid_photo_is_never_stored(self):
        self.dao.get_latest_user_claim_for_line.return_value = self.claim

        with self.assertRaises(HTTPException) as raised:
            self.service.attach_photo(7, 2041, 900, b"not an image at all" * 10)

        self.assertEqual(raised.exception.status_code, 400)
        self.storage.upload.assert_not_called()

    def test_second_photo_is_refused(self):
        self.dao.get_latest_user_claim_for_line.return_value = self.claim
        self.storage.upload.side_effect = ClaimPhotoExistsError("Une photo a déjà été envoyée pour ce produit.")

        with self.assertRaises(HTTPException) as raised:
            self.service.attach_photo(7, 2041, 900, image_bytes())

        self.assertEqual(raised.exception.status_code, 409)

    def test_admin_gets_a_short_signed_url(self):
        self.dao.get_claim.return_value = self.claim
        self.storage.signed_url.return_value = "https://example/sign/x"

        result = self.service.admin_photo_url(55)

        self.storage.signed_url.assert_called_once_with(claim_photo_path(self.claim))
        self.assertEqual(result.expires_in, 300)

    def test_admin_without_photo_gets_404(self):
        self.dao.get_claim.return_value = self.claim
        self.storage.signed_url.return_value = None

        with self.assertRaises(HTTPException) as raised:
            self.service.admin_photo_url(55)

        self.assertEqual(raised.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
