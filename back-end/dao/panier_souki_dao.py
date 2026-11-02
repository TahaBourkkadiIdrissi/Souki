from sqlalchemy.orm import selectinload
from entities.panier_souki_entity import PanierSouki, PanierSoukiLigne
from entities.product_entity import Product
from interfaces.panier_souki_dao_interface import IPanierSoukiDao


class PanierSoukiDao(IPanierSoukiDao):
    """DAO des paniers SOUKI : flush uniquement, le service gere commit et rollback."""

    def _query(self, session):
        return session.query(PanierSouki).options(selectinload(PanierSouki.lignes).selectinload(PanierSoukiLigne.produit))

    def list(self, session, *, active_only=False):
        query = self._query(session)
        if active_only:
            query = query.filter(PanierSouki.actif.is_(True))
        return query.order_by(PanierSouki.ordre, PanierSouki.id).all()

    def get(self, session, panier_id, *, lock=False):
        if lock:
            session.query(PanierSouki.id).filter(PanierSouki.id == panier_id).with_for_update().first()
        return self._query(session).filter(PanierSouki.id == panier_id).first()

    def get_products(self, session, product_ids):
        if not product_ids:
            return []
        return session.query(Product).filter(Product.id.in_(list(product_ids))).all()

    def create(self, session, values, lignes):
        row = PanierSouki(**values)
        row.lignes = [PanierSoukiLigne(**ligne) for ligne in lignes]
        session.add(row)
        session.flush()
        return row

    def update(self, session, panier, values, lignes):
        for key, value in values.items():
            setattr(panier, key, value)
        panier.lignes.clear()
        session.flush()
        panier.lignes.extend(PanierSoukiLigne(**ligne) for ligne in lignes)
        session.flush()
        return panier
