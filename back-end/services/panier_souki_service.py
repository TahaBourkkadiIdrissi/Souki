from datetime import datetime, timezone
from fastapi import HTTPException
from dto.panier_souki_dto import PanierSoukiDTO, PanierSoukiLigneDTO
from interfaces.panier_souki_service_interface import IPanierSoukiService
from services.checkout_service import PANIER_MINIMUM_DH
from services.commande_recurrente_service import _disponible, _frais, _prix


class PanierSoukiService(IPanierSoukiService):
    """Paniers proposes par SOUKI a l'abonnement, regles depuis le dashboard admin.
    Aucun prix n'est fige : le panier est estime et facture au prix du site du jour."""

    def __init__(self, dao, session):
        self.dao, self.session = dao, session

    def _get(self, panier_id, *, lock=False):
        row = self.dao.get(self.session, panier_id, lock=lock)
        if row is None:
            raise HTTPException(404, "Panier introuvable.")
        return row

    def _lignes(self, lignes):
        quantites = {}
        for ligne in lignes:
            quantites[ligne.product_id] = round(quantites.get(ligne.product_id, 0.0) + float(ligne.quantite), 3)
        products = {product.id: product for product in self.dao.get_products(self.session, quantites.keys())}
        if len(products) != len(quantites):
            raise HTTPException(400, "Un ou plusieurs produits sont introuvables.")
        sous_total = sum(_prix(products[product_id]) * quantite for product_id, quantite in quantites.items())
        if round(sous_total, 2) < PANIER_MINIMUM_DH:
            raise HTTPException(400, f"Un panier doit valoir au moins {PANIER_MINIMUM_DH:.0f} DH au prix du jour.")
        return [dict(product_id=product_id, quantite=quantite) for product_id, quantite in quantites.items()]

    @staticmethod
    def _values(payload):
        return dict(nom=payload.nom, description=payload.description, image_url=payload.image_url,
                    actif=payload.actif, ordre=payload.ordre)

    @staticmethod
    def _dto(row):
        lignes, sous_total = [], 0.0
        for ligne in row.lignes:
            product = ligne.produit
            prix = _prix(product) if product is not None else 0.0
            total = round(prix * float(ligne.quantite), 2)
            disponible = product is not None and _disponible(product, ligne.quantite)
            if disponible:
                sous_total += total
            lignes.append(PanierSoukiLigneDTO(
                product_id=ligne.product_id, nom_produit=product.nom_fr if product else "Produit retiré",
                nom_darija=getattr(product, "nom_darija", None) if product else None,
                unite=product.unite if product else "", image_url=product.image_url if product else None,
                quantite=float(ligne.quantite), prix_unitaire=prix, sous_total=total, disponible=disponible,
            ))
        sous_total = round(sous_total, 2)
        frais = _frais(sous_total)
        return PanierSoukiDTO(
            id=row.id, nom=row.nom, description=row.description, image_url=row.image_url, actif=row.actif,
            ordre=row.ordre, lignes=lignes, sous_total_estime=sous_total, frais_livraison_estimes=frais,
            total_estime=round(sous_total + frais, 2), created_at=row.created_at,
        )

    def list_public(self):
        # Un panier dont plus aucun produit n'est disponible n'est pas propose.
        return [dto for dto in (self._dto(row) for row in self.dao.list(self.session, active_only=True))
                if any(ligne.disponible for ligne in dto.lignes)]

    def list_admin(self):
        return [self._dto(row) for row in self.dao.list(self.session)]

    def create(self, payload):
        try:
            row = self.dao.create(self.session, self._values(payload), self._lignes(payload.lignes))
            result = self._dto(self._get(row.id))
            self.session.commit()
            return result
        except Exception:
            self.session.rollback()
            raise

    def update(self, panier_id, payload):
        try:
            row = self._get(panier_id, lock=True)
            values = dict(self._values(payload), updated_at=datetime.now(timezone.utc).replace(tzinfo=None))
            self.dao.update(self.session, row, values, self._lignes(payload.lignes))
            result = self._dto(self._get(panier_id))
            self.session.commit()
            return result
        except Exception:
            self.session.rollback()
            raise
