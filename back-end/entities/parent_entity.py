from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.orm import relationship
from config import Base


class Parent(Base):
    __tablename__ = "t_parents"

    user_id = Column(Integer, ForeignKey("t_users.id"), primary_key=True)

    user         = relationship("User", back_populates="parent_profile")
    abonnements  = relationship(
        "Abonnement",
        back_populates="parent",
        foreign_keys="Abonnement.parent_id",
    )
