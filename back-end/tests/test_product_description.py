import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from dao.produit_pricing_dao import ProduitPricingDaoBD
from dto.produit_pricing_dto import ProductCreateDTO, ProduitPricingUpdateDTO
from services.catalogue_service import CatalogueService
from services.produit_pricing_service import ProduitPricingServiceBD
from entities.product_entity import Product


class ProductDescriptionTests(unittest.TestCase):
    def setUp(self):
        self.product = SimpleNamespace(
            id=1, nom_fr="Tomates", nom_darija="tomates", description="Tomates pour salade.",
            prix_kg=10, prix_affiche=12, prix_gros_saisi=None, prix_khddar_reel=None,
            prix_vente_manuel=None, marge_cible=0.25, coussin_securite=0.1,
            volatilite="STABLE", is_active=True, image_url=None, niveau=2, unite="kg", stock=5,
        )
        self.session = MagicMock()
        self.session.query.return_value.filter.return_value.filter.return_value.first.return_value = self.product
        self.dao = ProduitPricingDaoBD()

    def test_edit_is_returned_to_admin_and_public_catalogue(self):
        self.dao.update_produit_pricing(self.session, 1, ProduitPricingUpdateDTO(description="Nouvelle description"))
        self.assertEqual(self.dao._to_dto(self.product).description, "Nouvelle description")
        self.assertEqual(CatalogueService(None)._to_product_response(self.product).description, "Nouvelle description")
        self.session.flush.assert_called_once()

    def test_unrelated_edit_preserves_description_and_explicit_null_restores_default(self):
        self.dao.update_produit_pricing(self.session, 1, ProduitPricingUpdateDTO(niveau=3))
        self.assertEqual(self.product.description, "Tomates pour salade.")
        self.dao.update_produit_pricing(self.session, 1, ProduitPricingUpdateDTO(description=None))
        self.assertIsNone(CatalogueService(None)._to_product_response(self.product).description)

    def test_reactivation_keeps_submitted_description(self):
        data = ProductCreateDTO(nom_fr="Tomates", nom_darija="tomates", prix_kg=10,
                                unite="kg", description="Description de création")
        self.dao.reactivate_product(self.session, self.product, data)
        self.assertEqual(self.product.description, data.description)

    def test_description_length_is_validated(self):
        with self.assertRaises(ValidationError):
            ProduitPricingUpdateDTO(description="x" * 5001)

    def test_create_and_edit_persist_only_for_the_selected_product(self):
        engine = create_engine("sqlite://")
        Product.__table__.create(engine)
        service = ProduitPricingServiceBD(self.dao)
        try:
            with Session(engine) as session:
                first = service.create_product(session, ProductCreateDTO(
                    nom_fr="Tomates", nom_darija="tomates", prix_kg=10, unite="kg",
                    description="Première description", prix_gros_saisi=7,
                ))
                second = service.create_product(session, ProductCreateDTO(
                    nom_fr="Carottes", nom_darija="carottes", prix_kg=8, unite="kg",
                    description="Description carottes", prix_gros_saisi=5,
                ))
                service.update_pricing(session, first.id, ProduitPricingUpdateDTO(description="Description modifiée"))
            with Session(engine) as session:
                self.assertEqual(self.dao.get_produit_pricing(session, first.id).description, "Description modifiée")
                self.assertEqual(self.dao.get_produit_pricing(session, second.id).description, "Description carottes")
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
