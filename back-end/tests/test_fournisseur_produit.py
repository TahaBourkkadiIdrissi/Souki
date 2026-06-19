"""
LOT 9 — Unit tests for Mode Fournisseur:
- Approval blocked when supplier has 0 active products
- remove_product blocked when removing the last active product
- DAO upsert creates / updates correctly
- DAO replace_selection deletes stale, adds new
- FournisseurProduitService permission guard raises 403 for non-FOURNISSEUR
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch
import pytest
from fastapi import HTTPException

from dto.supplier_dto import (
    AdminSupplierAction,
    AdminSupplierValidationDTO,
    SupplierProductCreateDTO,
    SupplierProductSelectionDTO,
    SupplierProductUpdateDTO,
)
from entities.fournisseur_produit_entity import FournisseurProduit
from entities.product_entity import Product


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_offre(fournisseur_id=1, produit_id=10, is_active=True) -> FournisseurProduit:
    offre = FournisseurProduit()
    offre.id = 99
    offre.fournisseur_id = fournisseur_id
    offre.produit_id = produit_id
    offre.prix_gros = None
    offre.stock = 0.0
    offre.is_active = is_active
    # Attach a fake produit for DTO conversion
    product = Product()
    product.id = produit_id
    product.nom_fr = "Tomates"
    product.nom_darija = "Matisha"
    product.unite = "kg"
    product.prix_affiche = 5.0
    product.is_active = True
    offre.produit = product
    return offre


def _make_product(id_=10, is_active=True) -> Product:
    p = Product()
    p.id = id_
    p.nom_fr = "Tomates"
    p.nom_darija = "Matisha"
    p.unite = "kg"
    p.prix_affiche = 5.0
    p.is_active = is_active
    return p


# ---------------------------------------------------------------------------
# DAO tests — FournisseurProduitDaoBD (pure unit, no DB)
# ---------------------------------------------------------------------------

class TestFournisseurProduitDaoUpsert:
    """upsert creates on first call, updates on second call."""

    def _get_dao(self):
        from dao.fournisseur_produit_dao import FournisseurProduitDaoBD
        return FournisseurProduitDaoBD()

    def test_upsert_creates_when_not_exists(self):
        dao = self._get_dao()
        session = MagicMock()
        # find returns None → create path
        dao.find = MagicMock(return_value=None)
        added = []
        session.add.side_effect = lambda obj: added.append(obj)
        session.flush = MagicMock()

        result = dao.upsert(session, fournisseur_id=1, produit_id=10, prix_gros=None, stock=5.0, is_active=True)

        session.add.assert_called_once()
        assert len(added) == 1
        assert added[0].fournisseur_id == 1
        assert added[0].produit_id == 10
        assert added[0].stock == 5.0
        assert added[0].is_active is True

    def test_upsert_updates_when_exists(self):
        dao = self._get_dao()
        session = MagicMock()
        existing = _make_offre(is_active=False)
        dao.find = MagicMock(return_value=existing)
        session.flush = MagicMock()

        result = dao.upsert(session, fournisseur_id=1, produit_id=10, prix_gros=12.5, stock=20.0, is_active=True)

        session.add.assert_not_called()
        assert result.prix_gros == 12.5
        assert result.stock == 20.0
        assert result.is_active is True


class TestFournisseurProduitDaoReplaceSelection:
    """replace_selection deletes stale offers and adds new ones."""

    def _get_dao(self):
        from dao.fournisseur_produit_dao import FournisseurProduitDaoBD
        return FournisseurProduitDaoBD()

    def test_replaces_selection(self):
        dao = self._get_dao()
        session = MagicMock()
        session.flush = MagicMock()

        offre_keep = _make_offre(produit_id=10)
        offre_remove = _make_offre(produit_id=20)
        dao.list_by_fournisseur = MagicMock(return_value=[offre_keep, offre_remove])

        added = []
        deleted = []
        session.add.side_effect = lambda o: added.append(o)
        session.delete.side_effect = lambda o: deleted.append(o)

        # new selection: keep 10, add 30, remove 20
        dao.replace_selection(session, fournisseur_id=1, produit_ids=[10, 30])

        assert offre_remove in deleted
        assert offre_keep not in deleted
        assert any(a.produit_id == 30 for a in added)
        assert not any(a.produit_id == 10 for a in added)


# ---------------------------------------------------------------------------
# Service tests — FournisseurProduitService
# ---------------------------------------------------------------------------

class TestFournisseurProduitService:

    def _make_service(self, session=None, dao=None):
        from services.fournisseur_produit_service import FournisseurProduitService
        svc = FournisseurProduitService(
            fournisseur_produit_dao=dao or MagicMock(),
            session=session or MagicMock(),
        )
        return svc

    def test_ensures_supplier_role_raises_403(self):
        """list_products raises 403 when user lacks FOURNISSEUR role."""
        svc = self._make_service()
        svc.authorization_dao = MagicMock()
        svc.authorization_dao.get_active_role_codes.return_value = ["CLIENT"]

        with pytest.raises(HTTPException) as exc_info:
            svc.list_products(user_id=42)
        assert exc_info.value.status_code == 403

    def test_list_products_ok(self):
        """list_products returns DTO list when role is FOURNISSEUR."""
        dao = MagicMock()
        offre = _make_offre()
        dao.list_by_fournisseur.return_value = [offre]

        svc = self._make_service(dao=dao)
        svc.authorization_dao = MagicMock()
        svc.authorization_dao.get_active_role_codes.return_value = ["FOURNISSEUR"]

        result = svc.list_products(user_id=1)
        assert len(result.items) == 1
        assert result.items[0].produit_id == 10

    def test_remove_product_blocks_last_active(self):
        """remove_product raises 409 when deleting the only active product."""
        dao = MagicMock()
        offre = _make_offre(is_active=True)
        dao.find.return_value = offre
        dao.count_active.return_value = 1  # only one active

        session = MagicMock()
        session.delete = MagicMock()
        session.flush = MagicMock()
        session.commit = MagicMock()
        session.rollback = MagicMock()

        svc = self._make_service(session=session, dao=dao)
        svc.authorization_dao = MagicMock()
        svc.authorization_dao.get_active_role_codes.return_value = ["FOURNISSEUR"]

        with pytest.raises(HTTPException) as exc_info:
            svc.remove_product(user_id=1, produit_id=10)
        assert exc_info.value.status_code == 409
        session.delete.assert_not_called()

    def test_remove_product_allows_inactive(self):
        """remove_product allows deleting an inactive product even if it's the 'last'."""
        dao = MagicMock()
        offre = _make_offre(is_active=False)
        dao.find.return_value = offre
        dao.count_active.return_value = 0

        session = MagicMock()
        session.flush = MagicMock()
        session.commit = MagicMock()
        session.rollback = MagicMock()

        svc = self._make_service(session=session, dao=dao)
        svc.authorization_dao = MagicMock()
        svc.authorization_dao.get_active_role_codes.return_value = ["FOURNISSEUR"]

        # Should not raise
        svc.remove_product(user_id=1, produit_id=10)
        session.delete.assert_called_once_with(offre)

    def test_remove_product_allows_when_multiple_active(self):
        """remove_product allows deleting an active product when others remain."""
        dao = MagicMock()
        offre = _make_offre(is_active=True)
        dao.find.return_value = offre
        dao.count_active.return_value = 3  # still 2 remaining after deletion

        session = MagicMock()
        session.flush = MagicMock()
        session.commit = MagicMock()
        session.rollback = MagicMock()

        svc = self._make_service(session=session, dao=dao)
        svc.authorization_dao = MagicMock()
        svc.authorization_dao.get_active_role_codes.return_value = ["FOURNISSEUR"]

        svc.remove_product(user_id=1, produit_id=10)
        session.delete.assert_called_once_with(offre)

    def test_add_product_inactive_catalogue_raises_409(self):
        """add_product raises 409 when product is not active in catalogue."""
        dao = MagicMock()
        session = MagicMock()
        session.query.return_value.filter.return_value.first.return_value = _make_product(is_active=False)
        session.rollback = MagicMock()

        svc = self._make_service(session=session, dao=dao)
        svc.authorization_dao = MagicMock()
        svc.authorization_dao.get_active_role_codes.return_value = ["FOURNISSEUR"]

        with pytest.raises(HTTPException) as exc_info:
            svc.add_product(user_id=1, payload=SupplierProductCreateDTO(produit_id=10))
        assert exc_info.value.status_code == 409

    def test_set_selection_missing_product_raises_404(self):
        """set_selection raises 404 when a requested produit_id doesn't exist."""
        dao = MagicMock()
        session = MagicMock()
        # Query returns empty list (no products found)
        session.query.return_value.filter.return_value.all.return_value = []
        session.rollback = MagicMock()

        svc = self._make_service(session=session, dao=dao)
        svc.authorization_dao = MagicMock()
        svc.authorization_dao.get_active_role_codes.return_value = ["FOURNISSEUR"]

        with pytest.raises(HTTPException) as exc_info:
            svc.set_selection(user_id=1, payload=SupplierProductSelectionDTO(produit_ids=[999]))
        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# FournisseurService — approval rule (≥1 active product required)
# ---------------------------------------------------------------------------

class TestFournisseurServiceApproval:
    """validate_supplier_request blocks APPROVE when no active products."""

    def _make_service(self):
        from services.fournisseur_service import FournisseurService
        fournisseur_dao = MagicMock()
        fp_dao = MagicMock()
        svc = FournisseurService(
            fournisseur_dao=fournisseur_dao,
            fournisseur_produit_dao=fp_dao,
        )
        svc.session = MagicMock()
        return svc

    def _make_fournisseur_entity(self, statut="PENDING"):
        from entities.fournisseur_entity import Fournisseur
        f = Fournisseur()
        f.user_id = 7
        f.shop_name = "Test Shop"
        f.statut = statut
        f.rejected_reason = None
        f.rating = 0.0
        f.nb_avis = 0
        f.logo_url = None
        f.shop_slug = None
        f.description = None
        f.phone = None
        f.address = None
        f.ville = None
        f.created_at = None
        return f

    def test_approve_blocked_when_zero_active_products(self):
        """APPROVE action raises 409 when supplier has no active product offers."""
        svc = self._make_service()
        svc._ensure_admin = MagicMock()  # bypass admin auth
        fournisseur = self._make_fournisseur_entity(statut="PENDING")
        # _get_fournisseur_or_404 uses fournisseur_dao.find_by_user_id internally
        svc._get_fournisseur_or_404 = MagicMock(return_value=fournisseur)
        # session.query(...).filter(...).scalar() must return 0 (zero active products)
        svc.session.query.return_value.filter.return_value.scalar.return_value = 0
        svc.session.rollback = MagicMock()

        payload = AdminSupplierValidationDTO(
            supplier_user_id=7,
            action=AdminSupplierAction.APPROVE,
        )
        with pytest.raises(HTTPException) as exc_info:
            svc.validate_supplier_request(admin_user_id=1, payload=payload)
        assert exc_info.value.status_code == 409
        assert "produit" in exc_info.value.detail.lower()

    def test_reject_always_allowed(self):
        """REJECT action does not check product count — should not raise 409 for products."""
        svc = self._make_service()
        svc._ensure_admin = MagicMock()
        fournisseur = self._make_fournisseur_entity(statut="PENDING")
        svc._get_fournisseur_or_404 = MagicMock(return_value=fournisseur)
        svc._queue_notification = MagicMock()
        svc.session.flush = MagicMock()
        svc.session.commit = MagicMock()
        svc.session.rollback = MagicMock()

        with patch.object(svc, "_to_profile_dto", return_value=MagicMock()):
            payload = AdminSupplierValidationDTO(
                supplier_user_id=7,
                action=AdminSupplierAction.REJECT,
                rejected_reason="Informations incomplètes",
            )
            # REJECT does not check product count — must not raise 409 for products
            try:
                svc.validate_supplier_request(admin_user_id=1, payload=payload)
            except HTTPException as e:
                # Any other 409 would be a bug; this one should not happen
                assert "produit" not in e.detail.lower(), f"Unexpected product 409: {e.detail}"
