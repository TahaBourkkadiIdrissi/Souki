from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from dto.category_dto import CategoryDTO, CatalogueCategoryDTO
from interfaces.category_service_interface import ICategoryService

# "tous" is the client's "all products" chip; it can never be a real section.
RESERVED_SLUGS = {"tous"}
FEATURED_NOT_ASSIGNED = "Le produit phare doit faire partie des produits cochés de la catégorie."


class CategoryService(ICategoryService):
    def __init__(self, dao, session):
        self.dao, self.session = dao, session

    def _get(self, category_id, *, lock=False):
        row = self.dao.get(self.session, category_id, lock=lock)
        if row is None:
            raise HTTPException(404, "Catégorie introuvable.")
        return row

    @staticmethod
    def _values(payload):
        values = payload.model_dump(exclude={"slug"})
        values["nom"] = values["nom"].strip()
        if not values["nom"]:
            raise HTTPException(400, "Le nom de la catégorie est obligatoire.")
        return values

    def _dto(self, row, product_ids):
        return CategoryDTO(**{key: getattr(row, key) for key in ("id", "slug", "nom", "icone", "produit_vedette_id", "ordre", "actif", "created_at")},
                           product_ids=product_ids.get(row.id, []))

    def list_admin(self):
        product_ids = self.dao.product_ids_by_category(self.session)
        return [self._dto(row, product_ids) for row in self.dao.list(self.session)]

    def list_public(self):
        product_ids = self.dao.product_ids_by_category(self.session, active_products_only=True)
        # The featured photo is only exposed while that product is active in the section.
        return [CatalogueCategoryDTO(id=row.id, slug=row.slug, nom=row.nom, icone=row.icone, ordre=row.ordre,
                                     produit_vedette_id=row.produit_vedette_id
                                     if row.produit_vedette_id in product_ids.get(row.id, []) else None,
                                     product_ids=product_ids.get(row.id, []))
                for row in self.dao.list(self.session, active_only=True)]

    def create(self, payload):
        try:
            if payload.slug in RESERVED_SLUGS:
                raise HTTPException(400, "Cet identifiant est réservé. Choisissez-en un autre.")
            if self.dao.by_slug(self.session, payload.slug) is not None:
                raise HTTPException(409, "Une catégorie utilise déjà cet identifiant.")
            # A new category has no products yet, so it cannot have a featured one.
            if payload.produit_vedette_id is not None:
                raise HTTPException(400, FEATURED_NOT_ASSIGNED)
            row = self.dao.create(self.session, dict(self._values(payload), slug=payload.slug))
            result = self._dto(row, {})
            self.session.commit()
            return result
        except IntegrityError:
            self.session.rollback()
            raise HTTPException(409, "Une catégorie utilise déjà cet identifiant.")
        except Exception:
            self.session.rollback()
            raise

    def update(self, category_id, payload):
        try:
            row = self._get(category_id, lock=True)
            product_ids = self.dao.product_ids_by_category(self.session)
            if payload.produit_vedette_id is not None and payload.produit_vedette_id not in product_ids.get(row.id, []):
                raise HTTPException(400, FEATURED_NOT_ASSIGNED)
            self.dao.update(self.session, row, self._values(payload))
            result = self._dto(row, product_ids)
            self.session.commit()
            return result
        except Exception:
            self.session.rollback()
            raise

    def set_products(self, category_id, payload):
        try:
            row = self._get(category_id, lock=True)
            product_ids = list(dict.fromkeys(payload.product_ids))
            missing = set(product_ids) - self.dao.existing_product_ids(self.session, product_ids)
            if missing:
                raise HTTPException(400, "Certains produits n'existent plus. Rechargez la liste avant d'enregistrer.")
            self.dao.replace_products(self.session, row.id, product_ids)
            # Unticking the featured product also removes it as the section photo.
            if row.produit_vedette_id is not None and row.produit_vedette_id not in product_ids:
                self.dao.update(self.session, row, {"produit_vedette_id": None})
            result = self._dto(row, {row.id: sorted(product_ids)})
            self.session.commit()
            return result
        except Exception:
            self.session.rollback()
            raise
