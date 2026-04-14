from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from entities import User, Address,Product, CommandeVocale, LigneCommandeVocale
from abc import ABC, abstractmethod
from typing import Optional, List
from sqlalchemy import func


class UserDao:
    @staticmethod
    def find_by_identifier(db: Session, identifier: str):
        return db.query(User).filter((User.email == identifier) | (User.phone == identifier)).first()

    @staticmethod
    def create(db: Session, user: User):
        try:
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        except IntegrityError:
            db.rollback() # On annule la transaction qui a échoué (ex: email déjà existant)
            return None   # On renvoie None pour que le Controller sache qu'il y a une erreur

class AddressDao:
    @staticmethod
    def get_count(db: Session, user_id: int):
        return db.query(Address).filter(Address.user_id == user_id).count()

    @staticmethod
    def create(db: Session, addr: Address):
        try:
            db.add(addr)
            db.commit()
            db.refresh(addr)
            return addr
        except Exception:
            db.rollback()
            return None






# ==========================================
# INTERFACES
# ==========================================
class IProductDao(ABC):
    @abstractmethod
    def get_by_alias(self, session: Session, alias: str) -> Optional[Product]: pass

    @abstractmethod
    def get_all(self, session: Session) -> List[Product]: pass

    @abstractmethod
    def decrement_stock(self, session: Session, product_id: int, quantity: float) -> bool: pass

class ICommandeVocaleDao(ABC):
    @abstractmethod
    def create_commande(self, session: Session, transcription: str, json_brut: str, langue: str) -> Optional[CommandeVocale]: pass

    @abstractmethod
    def create_ligne(self, session: Session, commande_id: int, product_id: int, qte_demandee: float, qte_effective: float, prix: float, sous_total: float, message: Optional[str]) -> bool: pass

# ==========================================
# IMPLEMENTATIONS
# ==========================================
class ProductDaoBD(IProductDao):
    def get_by_alias(self, session: Session, alias: str) -> Optional[Product]:
        alias_lower = alias.lower().strip()
        return session.query(Product).filter(
            (func.lower(Product.nom_fr) == alias_lower) | 
            (func.lower(Product.nom_darija) == alias_lower)
        ).first()

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

class CommandeVocaleDaoBD(ICommandeVocaleDao):
    def create_commande(self, session: Session, transcription: str, json_brut: str, langue: str) -> Optional[CommandeVocale]:
        cmd = CommandeVocale(transcription_brute=transcription, json_gemini_brut=json_brut, langue_detectee=langue)
        session.add(cmd)
        try:
            session.commit()
            session.refresh(cmd)
            return cmd
        except Exception as e:
            session.rollback()
            print(f"Erreur create commande: {e}")
            return None

    def create_ligne(self, session: Session, commande_id: int, product_id: int, qte_demandee: float, qte_effective: float, prix: float, sous_total: float, message: Optional[str]) -> bool:
        ligne = LigneCommandeVocale(
            commande_id=commande_id, product_id=product_id, quantite_demandee=qte_demandee,
            quantite_effective=qte_effective, prix_unitaire=prix, sous_total=sous_total, message_ajustement=message
        )
        session.add(ligne)
        try:
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            print(f"Erreur create ligne: {e}")
            return False