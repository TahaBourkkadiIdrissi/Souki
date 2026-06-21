from datetime import date, datetime
from types import SimpleNamespace

import pytest

from services.admin_exception_service import AdminExceptionService
from services.logistics_visibility import (
    is_livreur_tournee_row_visible,
    is_supplier_order_visible,
)


TODAY = date(2026, 6, 20)
SUPPLIER_ID = 10


@pytest.mark.parametrize(
    ("statut", "commande_date", "fournisseur_id", "raison"),
    [
        ("A_LIVRER", date(2026, 6, 19), SUPPLIER_ID, "JOUR_PRECEDENT"),
        ("BROUILLON", TODAY, SUPPLIER_ID, "BROUILLON"),
        ("RETOUR_DEPOT", TODAY, SUPPLIER_ID, "ECHEC_LIVRAISON"),
        ("ABSENT", TODAY, SUPPLIER_ID, "ECHEC_LIVRAISON"),
        ("REFUS", TODAY, SUPPLIER_ID, "ECHEC_LIVRAISON"),
        ("EN_ATTENTE", TODAY, SUPPLIER_ID, "PENDING_NON_VALIDE"),
        ("A_LIVRER", TODAY, None, "SANS_FOURNISSEUR"),
        ("STATUT_ABERRANT", TODAY, SUPPLIER_ID, "ABERRANT"),
    ],
)
def test_commandes_anormales_admin_uniquement(
    statut,
    commande_date,
    fournisseur_id,
    raison,
):
    commande = SimpleNamespace(
        statut=statut,
        date_commande=datetime.combine(commande_date, datetime.min.time()),
        fournisseur_id=fournisseur_id,
    )
    livreur_row = {
        "statut": statut,
        "date_tournee": commande_date,
        "fournisseur_id": fournisseur_id,
    }

    assert not is_supplier_order_visible(commande, SUPPLIER_ID, TODAY)
    assert not is_livreur_tournee_row_visible(livreur_row, TODAY)
    assert raison in AdminExceptionService.detect_raisons(commande, today=TODAY)


def test_flux_actif_du_jour_reste_visible_hors_admin():
    commande = SimpleNamespace(
        statut="A_LIVRER",
        date_commande=datetime(2026, 6, 20, 10, 0),
        fournisseur_id=SUPPLIER_ID,
    )
    livreur_row = {
        "statut": "A_LIVRER",
        "date_tournee": TODAY,
        "fournisseur_id": SUPPLIER_ID,
    }

    assert is_supplier_order_visible(commande, SUPPLIER_ID, TODAY)
    assert is_livreur_tournee_row_visible(livreur_row, TODAY)
    assert AdminExceptionService.detect_raisons(commande, today=TODAY) == []
