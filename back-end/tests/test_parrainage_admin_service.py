from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from services.business_errors import ResourceNotFoundError
from services.parrainage_service import (
    SIGNAL_IP_PARTAGEE,
    SIGNAL_MEME_ADRESSE,
    SIGNAL_MEME_CONNEXION,
    ParrainageService,
)


def _parrainage(pid=1, parrain_id=10, filleul_id=20, ip="41.0.0.1"):
    return SimpleNamespace(
        id=pid, parrain_id=parrain_id, filleul_id=filleul_id, code_utilise="ABC234", statut="EN_ATTENTE",
        credit_parrain=None, credit_filleul=None, ip_inscription=ip, created_at=None, converted_at=None,
    )


def _service(rows=None, points=None, ips=None, contacts=None):
    dao = MagicMock()
    dao.count_by_statut.return_value = {"EN_ATTENTE": len(rows or [])}
    dao.total_credit_distribue.return_value = 0.0
    dao.top_parrains.return_value = []
    dao.list_recent_with_contacts.return_value = rows or []
    dao.list_address_points.return_value = points or []
    dao.list_session_ips.return_value = ips or []
    dao.get_with_contacts.return_value = contacts
    return ParrainageService(dao), dao


def test_mask_phone_keeps_prefix_and_last_four_digits():
    assert ParrainageService._mask_contact("+212612345678", None) == "06 •• •• 56 78"
    assert ParrainageService._mask_contact("0712345678", None) == "07 •• •• 56 78"


def test_mask_email_keeps_domain():
    assert ParrainageService._mask_contact(None, "salah@example.com") == "sa***@example.com"


def test_overview_never_returns_full_phone():
    row = (_parrainage(), "+212612345678", None, "+212698765432", None)
    service, _ = _service(rows=[row])
    item = service.get_admin_overview(MagicMock()).recent[0]
    assert item.parrain_contact == "06 •• •• 56 78"
    assert item.filleul_contact == "06 •• •• 54 32"


def test_signals_same_address_and_same_connection():
    row = (_parrainage(), "+212612345678", None, "+212698765432", None)
    points = [(10, 34.0331, -5.0003), (20, 34.0332, -5.0004)]  # ~15 m
    service, _ = _service(rows=[row], points=points, ips=[(10, "41.0.0.1")])
    item = service.get_admin_overview(MagicMock()).recent[0]
    assert item.signaux == [SIGNAL_MEME_ADRESSE, SIGNAL_MEME_CONNEXION]


def test_signals_ignore_distant_addresses():
    row = (_parrainage(), None, None, None, None)
    points = [(10, 34.0331, -5.0003), (20, 34.0500, -5.0003)]  # ~1,9 km
    service, _ = _service(rows=[row], points=points)
    assert service.get_admin_overview(MagicMock()).recent[0].signaux == []


def test_signal_shared_ip_between_filleuls_of_same_parrain():
    rows = [
        (_parrainage(pid=1, filleul_id=20), None, None, None, None),
        (_parrainage(pid=2, filleul_id=21), None, None, None, None),
        (_parrainage(pid=3, parrain_id=11, filleul_id=22), None, None, None, None),
    ]
    service, _ = _service(rows=rows)
    recent = {item.id: item.signaux for item in service.get_admin_overview(MagicMock()).recent}
    assert recent == {1: [SIGNAL_IP_PARTAGEE], 2: [SIGNAL_IP_PARTAGEE], 3: []}


def test_reveal_returns_full_contacts_and_writes_audit_line(caplog):
    contacts = (_parrainage(pid=5), "+212612345678", None, None, "filleul@example.com")
    service, _ = _service(contacts=contacts)
    with caplog.at_level("INFO", logger="souki.audit"):
        dto = service.reveal_contacts(MagicMock(), parrainage_id=5, staff_user_id=99)
    assert dto.parrain_contact == "+212612345678"
    assert dto.filleul_contact == "filleul@example.com"
    assert "parrainage_id=5" in caplog.text and "staff_user_id=99" in caplog.text


def test_reveal_unknown_parrainage_raises_not_found():
    service, _ = _service(contacts=None)
    with pytest.raises(ResourceNotFoundError):
        service.reveal_contacts(MagicMock(), parrainage_id=404, staff_user_id=1)
