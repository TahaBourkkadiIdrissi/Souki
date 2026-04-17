from fastapi import Depends
from interfaces.product_dao_interface import IProductDao
from interfaces.commande_dao_interface import ICommandeVocaleDao
from interfaces.catalogue_service_interface import ICatalogueService
from interfaces.commande_service_interface import ICommandeVocaleService
from dao.product_dao import ProductDaoBD
from dao.commande_dao import CommandeVocaleDaoBD
from services.catalogue_service import CatalogueService
from services.commande_service import CommandeVocaleService


def get_product_dao() -> IProductDao:
    return ProductDaoBD()


def get_commande_dao() -> ICommandeVocaleDao:
    return CommandeVocaleDaoBD()


def get_catalogue_service(
    product_dao: IProductDao = Depends(get_product_dao)
) -> ICatalogueService:
    return CatalogueService(product_dao)


def get_voice_service(
    product_dao: IProductDao = Depends(get_product_dao),
    commande_dao: ICommandeVocaleDao = Depends(get_commande_dao)
) -> ICommandeVocaleService:
    return CommandeVocaleService(product_dao, commande_dao)
