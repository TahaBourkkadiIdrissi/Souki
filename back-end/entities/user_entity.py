from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from config import Base


class User(Base):
    __tablename__ = 't_users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(128), unique=True, index=True, nullable=True)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    password = Column(String(128), nullable=True)  # nullable=True pour Google login
    role = Column(String(20), default="CLIENT")  # CLIENT, PARENT, LIVREUR, ADMIN
    is_verified = Column(Boolean, default=False)

    # Relation Parent-Enfant
    parent_id = Column(Integer, ForeignKey('t_users.id'), nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    addresses = relationship("Address", back_populates="owner")

    class Config:
        from_attributes = True
