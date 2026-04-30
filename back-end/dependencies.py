from fastapi import Depends

from dao.claim_dao import ClaimDaoBD
from dao.checkout_dao import CheckoutDaoBD
from dao.cod_confirmation_log_dao import CODConfirmationLogDaoBD
from dao.commande_dao import CommandeVocaleDaoBD
from dao.notification_outbox_dao import NotificationOutboxDaoBD
from dao.panier_dao import PanierDaoBD
from dao.livreur_dao import LivreurDaoBD
from dao.product_dao import ProductDaoBD
from dao.souki_wallet_dao import SoukiWalletDaoBD
from interfaces.catalogue_service_interface import ICatalogueService
from interfaces.claim_dao_interface import IClaimDao
from interfaces.claim_service_interface import IClaimService
from interfaces.checkout_dao_interface import ICheckoutDao
from interfaces.checkout_service_interface import ICheckoutService
from interfaces.cod_confirmation_log_dao_interface import ICODConfirmationLogDao
from interfaces.cod_confirmation_service_interface import ICODConfirmationService
from interfaces.commande_dao_interface import ICommandeVocaleDao
from interfaces.commande_service_interface import ICommandeVocaleService
from interfaces.livreur_dao_interface import ILivreurDao
from interfaces.livreur_service_interface import ILivreurService
from interfaces.notification_outbox_dao_interface import INotificationOutboxDao
from interfaces.notification_outbox_service_interface import INotificationOutboxService
from interfaces.panier_dao_interface import IPanierDao
from interfaces.panier_service_interface import IPanierService
from interfaces.product_dao_interface import IProductDao
from interfaces.souki_wallet_dao_interface import ISoukiWalletDao
from interfaces.souki_wallet_service_interface import ISoukiWalletService
from services.catalogue_service import CatalogueService
from services.claim_service import ClaimService
from services.checkout_service import CheckoutService
from services.cod_confirmation_service import CODConfirmationService
from services.commande_service import CommandeVocaleService
from services.livreur_service import LivreurService
from services.notification_outbox_service import NotificationOutboxService
from services.panier_service import PanierService
from services.souki_wallet_service import SoukiWalletService


def get_product_dao() -> IProductDao:
    return ProductDaoBD()


def get_claim_dao() -> IClaimDao:
    return ClaimDaoBD()


def get_commande_dao() -> ICommandeVocaleDao:
    return CommandeVocaleDaoBD()


def get_cod_confirmation_log_dao() -> ICODConfirmationLogDao:
    return CODConfirmationLogDaoBD()


def get_checkout_dao() -> ICheckoutDao:
    return CheckoutDaoBD()


def get_livreur_dao() -> ILivreurDao:
    return LivreurDaoBD()


def get_notification_outbox_dao() -> INotificationOutboxDao:
    return NotificationOutboxDaoBD()


def get_panier_dao() -> IPanierDao:
    return PanierDaoBD()


def get_souki_wallet_dao() -> ISoukiWalletDao:
    return SoukiWalletDaoBD()


def get_catalogue_service(
    product_dao: IProductDao = Depends(get_product_dao)
) -> ICatalogueService:
    return CatalogueService(product_dao)


def get_notification_outbox_service(
    notification_outbox_dao: INotificationOutboxDao = Depends(get_notification_outbox_dao)
) -> INotificationOutboxService:
    return NotificationOutboxService(notification_outbox_dao)


def get_voice_service(
    product_dao: IProductDao = Depends(get_product_dao),
    commande_dao: ICommandeVocaleDao = Depends(get_commande_dao)
) -> ICommandeVocaleService:
    return CommandeVocaleService(product_dao, commande_dao)


def get_cod_confirmation_service(
    commande_dao: ICommandeVocaleDao = Depends(get_commande_dao),
    cod_confirmation_log_dao: ICODConfirmationLogDao = Depends(get_cod_confirmation_log_dao),
) -> ICODConfirmationService:
    return CODConfirmationService(commande_dao, cod_confirmation_log_dao)


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


def get_souki_wallet_service(
    souki_wallet_dao: ISoukiWalletDao = Depends(get_souki_wallet_dao)
) -> ISoukiWalletService:
    return SoukiWalletService(souki_wallet_dao)


def get_claim_service(
    claim_dao: IClaimDao = Depends(get_claim_dao),
    souki_wallet_service: ISoukiWalletService = Depends(get_souki_wallet_service),
    commande_dao: ICommandeVocaleDao = Depends(get_commande_dao),
    notification_outbox_service: INotificationOutboxService = Depends(get_notification_outbox_service),
) -> IClaimService:
    return ClaimService(
        claim_dao=claim_dao,
        souki_wallet_service=souki_wallet_service,
        commande_dao=commande_dao,
        notification_outbox_service=notification_outbox_service,
    )
