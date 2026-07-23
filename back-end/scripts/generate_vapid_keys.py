"""Genere la paire de cles VAPID des notifications push.

Usage (depuis back-end/) :  python scripts/generate_vapid_keys.py

Sortie : les deux lignes a coller dans back-end/.env. A ne faire qu'une fois :
changer la cle publique invalide tous les abonnements existants, chaque
navigateur devant re-souscrire avec le nouvel applicationServerKey.
"""

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64url(raw: bytes) -> str:
    # Base64 URL-safe sans padding : format attendu par la spec Web Push, aussi
    # bien par `applicationServerKey` cote navigateur que par py-vapid.
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def generate_vapid_keypair() -> tuple[str, str]:
    """Retourne (cle_publique, cle_privee) encodees en base64url."""
    private_key = ec.generate_private_key(ec.SECP256R1())

    private_raw = private_key.private_numbers().private_value.to_bytes(32, "big")
    public_raw = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    return _b64url(public_raw), _b64url(private_raw)


if __name__ == "__main__":
    public_key, private_key_value = generate_vapid_keypair()
    print("# A coller dans back-end/.env")
    print(f"VAPID_PUBLIC_KEY={public_key}")
    print(f"VAPID_PRIVATE_KEY={private_key_value}")
