from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from config import Base


class Category(Base):
    __tablename__ = "t_categories"
    id = Column(Integer, primary_key=True)
    slug = Column(String(48), nullable=False, unique=True)
    nom = Column(String(80), nullable=False)
    ordre = Column(Integer, nullable=False, default=0)
    actif = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class ProductCategory(Base):
    __tablename__ = "t_product_categories"
    product_id = Column(Integer, ForeignKey("T_Product.id", ondelete="CASCADE"), primary_key=True)
    category_id = Column(Integer, ForeignKey("t_categories.id", ondelete="CASCADE"), primary_key=True, index=True)
