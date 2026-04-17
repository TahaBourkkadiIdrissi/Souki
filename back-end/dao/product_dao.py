from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from interfaces.product_dao_interface import IProductDao
from entities.product_entity import Product


class ProductDaoBD(IProductDao):

    def get_by_alias(self, session: Session, alias: str) -> Optional[Product]:
        alias_lower = alias.lower().strip()
        return (
            session.query(Product)
            .filter(
                (func.lower(Product.nom_fr) == alias_lower) |
                (func.lower(Product.nom_darija) == alias_lower)
            )
            .first()
        )

    def get_all(self, session: Session) -> List[Product]:
        return session.query(Product).all()

    def decrement_stock(self, session: Session, product_id: int, quantity: float) -> bool:
        product = session.query(Product).filter(Product.id == product_id).first()
        if product and product.stock >= quantity:
            product.stock -= quantity
            try:
                session.commit()
                return True
            except Exception as e:
                session.rollback()
                print(f"Erreur decrement stock: {e}")
                return False
        return False
