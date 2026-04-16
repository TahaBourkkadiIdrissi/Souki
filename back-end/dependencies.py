from fastapi import Depends
from interfaces import IProductDao, ICommandeVocaleDao
from services import ICatalogueService, ICommandeVocaleService, CatalogueService, CommandeVocaleService
from dao import ProductDaoBD, CommandeVocaleDaoBD


def get_product_dao() -> IProductDao:
    return ProductDaoBD()


def get_commande_dao() -> ICommandeVocaleDao:
    return CommandeVocaleDaoBD()


def get_catalogue_service(product_dao: IProductDao = Depends(get_product_dao)) -> ICatalogueService:
    return CatalogueService(product_dao)


def get_voice_service(
    product_dao: IProductDao = Depends(get_product_dao),
    commande_dao: ICommandeVocaleDao = Depends(get_commande_dao)
) -> ICommandeVocaleService:
    return CommandeVocaleService(product_dao, commande_dao)