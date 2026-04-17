from typing import List, Optional
from config import LocalSession
from interfaces.catalogue_service_interface import ICatalogueService
from interfaces.product_dao_interface import IProductDao
from dto.product_dto import ProductResponseDTO
from dto.commande_dto import LigneCommandeDTO


class CatalogueService(ICatalogueService):

    def __init__(self, product_dao: IProductDao, session=None) -> None:
        self.product_dao = product_dao
        self.session = session

    # ── Context manager (gestion de session) ──────────────────────────────────
    def __enter__(self):
        if self.session is None:
            self.session = LocalSession()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            if exc_type is not None:
                self.session.rollback()
            self.session.close()

    # ── Méthodes publiques ────────────────────────────────────────────────────
    def get_catalogue_complet(self) -> List[ProductResponseDTO]:
        products = self.product_dao.get_all(self.session)
        return [
            ProductResponseDTO(
                id=p.id,
                nom_fr=str(p.nom_fr),
                nom_darija=str(p.nom_darija),
                prix_kg=float(p.prix_kg),
                unite=str(p.unite),
                stock=float(p.stock)
            )
            for p in products
        ]

    def valider_et_ajuster_item(self, item_gemini: dict) -> tuple[Optional[LigneCommandeDTO], Optional[str]]:
        """
        Vérifie la disponibilité et ajuste la quantité si le stock est limité.
        Retourne (LigneCommandeDTO, None) si OK, ou (None, nom_produit) si indisponible.
        """
        alias = item_gemini.get("produit_darija") or item_gemini.get("produit_fr")
        if not alias:
            return None, "Inconnu"

        produit = self.product_dao.get_by_alias(self.session, alias)
        if not produit:
            return None, alias

        qte_demandee = float(item_gemini.get("quantite", 1.0))
        qte_effective = qte_demandee
        message = None

        if qte_demandee > produit.stock:
            qte_effective = produit.stock
            if qte_effective == 0:
                return None, alias
            message = f"Stock limité à {produit.stock} {produit.unite} pour {produit.nom_fr}"

        sous_total = round(qte_effective * produit.prix_kg, 2)
        return LigneCommandeDTO(
            product_id=produit.id,
            nom_produit=produit.nom_fr,
            quantite_demandee=qte_demandee,
            quantite_effective=qte_effective,
            prix_unitaire=produit.prix_kg,
            sous_total=sous_total,
            message_ajustement=message
        ), None
