import re

import phonenumbers
from phonenumbers import PhoneNumberType

_MOROCCAN_PATTERN = re.compile(r"^\+212[67]\d{8}$")


def normalize_moroccan_phone(raw: str) -> str:
    """Convertit 06XXXXXXXX / 6XXXXXXXX / 00212XXXXXXXXX → +212XXXXXXXXX."""
    v = raw.strip().replace(" ", "").replace("-", "")
    if v.startswith("+212"):
        return v
    if v.startswith("00212"):
        return "+" + v[2:]
    if v.startswith("0"):
        return "+212" + v[1:]
    return "+212" + v


def validate_moroccan_phone(value: str | None) -> str | None:
    """
    Valide et normalise un numéro de téléphone marocain.

    Accepte : 06XXXXXXXX, 07XXXXXXXX, +212XXXXXXXXX, 00212XXXXXXXXX
    Rejette : tout numéro non mobile, non attribué par l'ANRT, ou mal formaté.

    Retourne None si value est vide/None (champ optionnel).
    Lève ValueError avec message clair si le numéro est fourni mais invalide.
    """
    if not value or not value.strip():
        return None

    normalized = normalize_moroccan_phone(value)

    if not _MOROCCAN_PATTERN.match(normalized):
        raise ValueError(
            "Numéro invalide. Format attendu : 06XXXXXXXX, 07XXXXXXXX ou +212XXXXXXXXX"
        )

    try:
        parsed = phonenumbers.parse(normalized, None)
    except phonenumbers.NumberParseException:
        raise ValueError("Numéro de téléphone non reconnu")

    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("Ce numéro n'existe pas dans le plan de numérotation marocain (ANRT)")

    if phonenumbers.number_type(parsed) not in (PhoneNumberType.MOBILE, PhoneNumberType.FIXED_LINE_OR_MOBILE):
        raise ValueError("Seuls les numéros mobiles marocains sont acceptés (06 / 07)")

    return normalized
