from fastapi import Depends

from dao.checkout_dao import CheckoutDaoBD
from dao.commande_dao import CommandeVocaleDaoBD
from dao.livreur_dao import LivreurDaoBD
from dao.product_dao import ProductDaoBD
from dao.panier_dao import PanierDaoBD
from interfaces.catalogue_service_interface import ICatalogueService
from interfaces.checkout_dao_interface import ICheckoutDao
from interfaces.checkout_service_interface import ICheckoutService
from interfaces.commande_dao_interface import ICommandeVocaleDao
from interfaces.commande_service_interface import ICommandeVocaleService
from interfaces.livreur_dao_interface import ILivreurDao
from interfaces.livreur_service_interface import ILivreurService
from interfaces.panier_dao_interface import IPanierDao
from interfaces.panier_service_interface import IPanierService
from interfaces.product_dao_interface import IProductDao
from services.catalogue_service import CatalogueService
from services.checkout_service import CheckoutService
from services.commande_service import CommandeVocaleService
from services.livreur_service import LivreurService
from services.panier_service import PanierService


def get_product_dao() -> IProductDao:
    return ProductDaoBD()


def get_commande_dao() -> ICommandeVocaleDao:
    return CommandeVocaleDaoBD()


def get_checkout_dao() -> ICheckoutDao:
    return CheckoutDaoBD()


def get_livreur_dao() -> ILivreurDao:
    return LivreurDaoBD()
def get_panier_dao() -> IPanierDao:
    return PanierDaoBD()


def get_catalogue_service(
    product_dao: IProductDao = Depends(get_product_dao)
) -> ICatalogueService:
    return CatalogueService(product_dao)


def get_voice_service(
    product_dao: IProductDao = Depends(get_product_dao),
    commande_dao: ICommandeVocaleDao = Depends(get_commande_dao)
) -> ICommandeVocaleService:
    return CommandeVocaleService(product_dao, commande_dao)


def get_checkout_service(
    checkout_dao: ICheckoutDao = Depends(get_checkout_dao)
) -> ICheckoutService:
    return CheckoutService(checkout_dao)


def get_livreur_service(
    livreur_dao: ILivreurDao = Depends(get_livreur_dao)
) -> ILivreurService:
    return LivreurService(livreur_dao)
def get_panier_service(
    panier_dao: IPanierDao = Depends(get_panier_dao)
) -> IPanierService:
    return PanierService(panier_dao)
