from fastapi import Depends

from dao.checkout_dao import CheckoutDaoBD
from dao.commande_dao import CommandeVocaleDaoBD
from dao.product_dao import ProductDaoBD
from interfaces.catalogue_service_interface import ICatalogueService
from interfaces.checkout_dao_interface import ICheckoutDao
from interfaces.checkout_service_interface import ICheckoutService
from interfaces.commande_dao_interface import ICommandeVocaleDao
from interfaces.commande_service_interface import ICommandeVocaleService
from interfaces.product_dao_interface import IProductDao
from services.catalogue_service import CatalogueService
from services.checkout_service import CheckoutService
from services.commande_service import CommandeVocaleService


def get_product_dao() -> IProductDao:
    return ProductDaoBD()


def get_commande_dao() -> ICommandeVocaleDao:
    return CommandeVocaleDaoBD()


def get_checkout_dao() -> ICheckoutDao:
    return CheckoutDaoBD()


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
