import unittest

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import entities  # noqa: F401  (registers every mapper used by Product relationships)
from dao.category_dao import CategoryDao
from dto.category_dto import CategoryCreateDTO, CategoryProductsDTO, CategoryUpdateDTO
from entities.category_entity import Category, ProductCategory
from entities.product_entity import Product
from services.category_service import CategoryService


class CategoryServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        for model in (Product, Category, ProductCategory):
            model.__table__.create(self.engine)
        self.session = Session(self.engine)
        self.session.add_all([
            Product(id=1, nom_fr="Mangue", nom_darija="mango", prix_kg=30, unite="kg", stock=10, is_active=True),
            Product(id=2, nom_fr="Ananas", nom_darija="ananas", prix_kg=25, unite="piece", stock=5, is_active=True),
            Product(id=3, nom_fr="Ancien", nom_darija="9dim", prix_kg=5, unite="kg", stock=0, is_active=False),
        ])
        self.session.commit()
        self.service = CategoryService(CategoryDao(), self.session)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def create(self, **changes):
        return self.service.create(CategoryCreateDTO(**{"slug": "fruits", "nom": "Fruits", "ordre": 20, **changes}))

    def test_create_assign_and_public_listing(self):
        fruits = self.create()
        seasonal = self.create(slug="saisonnieres", nom="Saisonnières", ordre=5)
        self.service.set_products(fruits.id, CategoryProductsDTO(product_ids=[2, 1, 1, 3]))
        self.service.set_products(seasonal.id, CategoryProductsDTO(product_ids=[1]))
        public = self.service.list_public()
        self.assertEqual([row.slug for row in public], ["saisonnieres", "fruits"])
        # Inactive products are not exposed publicly but stay assigned in the admin.
        self.assertEqual(public[1].product_ids, [1, 2])
        admin = {row.slug: row for row in self.service.list_admin()}
        self.assertEqual(admin["fruits"].product_ids, [1, 2, 3])

    def test_reassign_replaces_previous_products(self):
        fruits = self.create()
        self.service.set_products(fruits.id, CategoryProductsDTO(product_ids=[1, 2]))
        result = self.service.set_products(fruits.id, CategoryProductsDTO(product_ids=[2]))
        self.assertEqual(result.product_ids, [2])
        self.assertEqual(self.session.query(ProductCategory).count(), 1)

    def test_unknown_product_is_rejected_without_partial_write(self):
        fruits = self.create()
        self.service.set_products(fruits.id, CategoryProductsDTO(product_ids=[1]))
        with self.assertRaises(HTTPException) as error:
            self.service.set_products(fruits.id, CategoryProductsDTO(product_ids=[2, 99]))
        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(self.service.list_admin()[0].product_ids, [1])

    def test_duplicate_reserved_and_invalid_slugs(self):
        self.create()
        with self.assertRaises(HTTPException) as duplicate:
            self.create(nom="Autres fruits")
        self.assertEqual(duplicate.exception.status_code, 409)
        with self.assertRaises(HTTPException) as reserved:
            self.create(slug="tous")
        self.assertEqual(reserved.exception.status_code, 400)
        with self.assertRaises(ValidationError):
            CategoryCreateDTO(slug="Fruits d'été", nom="Fruits")

    def test_update_and_hide_category(self):
        fruits = self.create()
        updated = self.service.update(fruits.id, CategoryUpdateDTO(nom="  Fruits frais ", ordre=1, actif=False))
        self.assertEqual((updated.nom, updated.slug, updated.actif), ("Fruits frais", "fruits", False))
        self.assertEqual(self.service.list_public(), [])
        with self.assertRaises(HTTPException) as missing:
            self.service.update(404, CategoryUpdateDTO(nom="X"))
        self.assertEqual(missing.exception.status_code, 404)

    def test_icon_and_featured_product(self):
        fruits = self.create(icone="pomme")
        self.assertEqual(fruits.icone, "pomme")
        with self.assertRaises(ValidationError):
            CategoryCreateDTO(slug="saison", nom="Saison", icone="licorne")
        # A brand-new category has no products, so no featured one either.
        with self.assertRaises(HTTPException) as early:
            self.create(slug="saison", nom="Saison", produit_vedette_id=1)
        self.assertEqual(early.exception.status_code, 400)

        self.service.set_products(fruits.id, CategoryProductsDTO(product_ids=[1, 3]))
        with self.assertRaises(HTTPException) as foreign:
            self.service.update(fruits.id, CategoryUpdateDTO(nom="Fruits", icone="pomme", produit_vedette_id=2))
        self.assertEqual(foreign.exception.status_code, 400)

        # An inactive featured product is kept in the admin but hidden from the client.
        updated = self.service.update(fruits.id, CategoryUpdateDTO(nom="Fruits", icone="pomme", produit_vedette_id=3))
        self.assertEqual(updated.produit_vedette_id, 3)
        self.assertIsNone(self.service.list_public()[0].produit_vedette_id)

        self.service.update(fruits.id, CategoryUpdateDTO(nom="Fruits", icone="pomme", produit_vedette_id=1))
        public = self.service.list_public()[0]
        self.assertEqual((public.icone, public.produit_vedette_id), ("pomme", 1))

        # Unticking the featured product clears it.
        self.assertIsNone(self.service.set_products(fruits.id, CategoryProductsDTO(product_ids=[3])).produit_vedette_id)

    def test_blank_name_is_rejected(self):
        with self.assertRaises(HTTPException) as error:
            self.create(nom="   ")
        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(self.session.query(Category).count(), 0)


if __name__ == "__main__":
    unittest.main()
