from fastapi import Depends

from dao.claim_dao import ClaimDaoBD
from dao.client_admin_dao import ClientAdminDaoBD
from dao.client_blacklist_dao import ClientBlacklistDaoBD
from dao.checkout_dao import CheckoutDaoBD
from dao.cod_confirmation_log_dao import CODConfirmationLogDaoBD
from dao.commande_dao import CommandeVocaleDaoBD
from dao.dashboard_dao import DashboardDaoBD
from dao.fournisseur_dao import FournisseurDaoBD
from dao.fournisseur_produit_dao import FournisseurProduitDaoBD
from dao.notification_outbox_dao import NotificationOutboxDaoBD
from dao.panier_dao import PanierDaoBD
from dao.parrainage_dao import ParrainageDaoBD
from dao.livreur_dao import LivreurDaoBD
from dao.product_dao import ProductDaoBD
from dao.produit_pricing_dao import ProduitPricingDaoBD
from dao.souki_wallet_dao import SoukiWalletDaoBD
from dao.tournee_dao import TourneeDaoBD
from interfaces.catalogue_service_interface import ICatalogueService
from interfaces.claim_dao_interface import IClaimDao
from interfaces.claim_service_interface import IClaimService
from interfaces.client_admin_dao_interface import IClientAdminDao
from interfaces.client_admin_service_interface import IClientAdminService
from interfaces.client_blacklist_dao_interface import IClientBlacklistDao
from interfaces.client_blacklist_service_interface import IClientBlacklistService
from interfaces.checkout_dao_interface import ICheckoutDao
from interfaces.checkout_service_interface import ICheckoutService
from interfaces.cod_confirmation_log_dao_interface import ICODConfirmationLogDao
from interfaces.cod_confirmation_service_interface import ICODConfirmationService
from interfaces.commande_dao_interface import ICommandeVocaleDao
from interfaces.commande_service_interface import ICommandeVocaleService
from interfaces.dashboard_dao_interface import IDashboardDao
from interfaces.dashboard_service_interface import IDashboardService
from interfaces.dispatch_service_interface import IDispatchService
from interfaces.fournisseur_dao_interface import IFournisseurDao
from interfaces.fournisseur_service_interface import IFournisseurService
from interfaces.fournisseur_produit_dao_interface import IFournisseurProduitDao
from interfaces.fournisseur_produit_service_interface import IFournisseurProduitService
from interfaces.livreur_dao_interface import ILivreurDao
from interfaces.livreur_service_interface import ILivreurService
from interfaces.notification_outbox_dao_interface import INotificationOutboxDao
from interfaces.notification_outbox_service_interface import INotificationOutboxService
from interfaces.panier_dao_interface import IPanierDao
from interfaces.panier_service_interface import IPanierService
from interfaces.parrainage_dao_interface import IParrainageDao
from interfaces.parrainage_service_interface import IParrainageService
from interfaces.product_dao_interface import IProductDao
from interfaces.produit_pricing_dao_interface import IProduitPricingDao
from interfaces.produit_pricing_service_interface import IProduitPricingService
from interfaces.souki_wallet_dao_interface import ISoukiWalletDao
from interfaces.souki_wallet_service_interface import ISoukiWalletService
from interfaces.tournee_dao_interface import ITourneeDao
from services.catalogue_service import CatalogueService
from services.claim_service import ClaimService
from services.client_admin_service import ClientAdminService
from services.client_blacklist_service import ClientBlacklistService
from services.checkout_service import CheckoutService
from services.cod_confirmation_service import CODConfirmationService
from services.commande_service import CommandeVocaleService
from services.dashboard_service import DashboardService
from services.dispatch_service import DispatchService
from services.fournisseur_service import FournisseurService
from services.fournisseur_produit_service import FournisseurProduitService
from services.livreur_service import LivreurService
from services.dish_composition_service import DishCompositionService, dish_composition_service
from services.ml_panier_service import MLPanierService, ml_panier_service
from services.notification_outbox_service import NotificationOutboxService
from services.panier_service import PanierService
from services.parrainage_service import ParrainageService
from services.produit_pricing_service import ProduitPricingServiceBD
from services.souki_wallet_service import SoukiWalletService


def get_product_dao() -> IProductDao:
    return ProductDaoBD()


def get_produit_pricing_dao() -> IProduitPricingDao:
    return ProduitPricingDaoBD()


def get_claim_dao() -> IClaimDao:
    return ClaimDaoBD()


def get_blacklist_dao() -> IClientBlacklistDao:
    return ClientBlacklistDaoBD()


def get_client_admin_dao() -> IClientAdminDao:
    return ClientAdminDaoBD()


def get_dashboard_dao(
    blacklist_dao: IClientBlacklistDao = Depends(get_blacklist_dao),
    client_admin_dao: IClientAdminDao = Depends(get_client_admin_dao),
) -> IDashboardDao:
    return DashboardDaoBD(
        client_blacklist_dao=blacklist_dao,
        client_admin_dao=client_admin_dao,
    )


def get_commande_dao() -> ICommandeVocaleDao:
    return CommandeVocaleDaoBD()


def get_cod_confirmation_log_dao() -> ICODConfirmationLogDao:
    return CODConfirmationLogDaoBD()


def get_checkout_dao() -> ICheckoutDao:
    return CheckoutDaoBD()


def get_livreur_dao() -> ILivreurDao:
    return LivreurDaoBD()


def get_fournisseur_dao() -> IFournisseurDao:
    return FournisseurDaoBD()


def get_fournisseur_produit_dao() -> IFournisseurProduitDao:
    return FournisseurProduitDaoBD()


def get_notification_outbox_dao() -> INotificationOutboxDao:
    return NotificationOutboxDaoBD()


def get_panier_dao() -> IPanierDao:
    return PanierDaoBD()


def get_souki_wallet_dao() -> ISoukiWalletDao:
    return SoukiWalletDaoBD()


def get_tournee_dao() -> ITourneeDao:
    return TourneeDaoBD()


def get_catalogue_service(
    product_dao: IProductDao = Depends(get_product_dao)
) -> ICatalogueService:
    return CatalogueService(product_dao)


def get_produit_pricing_service(
    dao: IProduitPricingDao = Depends(get_produit_pricing_dao)
) -> IProduitPricingService:
    return ProduitPricingServiceBD(dao=dao)


def get_notification_outbox_service(
    notification_outbox_dao: INotificationOutboxDao = Depends(get_notification_outbox_dao)
) -> INotificationOutboxService:
    return NotificationOutboxService(notification_outbox_dao)


def get_blacklist_service(
    blacklist_dao: IClientBlacklistDao = Depends(get_blacklist_dao)
) -> IClientBlacklistService:
    return ClientBlacklistService(blacklist_dao)


def get_client_admin_service(
    client_admin_dao: IClientAdminDao = Depends(get_client_admin_dao)
) -> IClientAdminService:
    return ClientAdminService(client_admin_dao)


def get_dashboard_service(
    dashboard_dao: IDashboardDao = Depends(get_dashboard_dao)
) -> IDashboardService:
    return DashboardService(dashboard_dao)


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


def get_dispatch_service(
    commande_dao: ICommandeVocaleDao = Depends(get_commande_dao),
    livreur_dao: ILivreurDao = Depends(get_livreur_dao),
    tournee_dao: ITourneeDao = Depends(get_tournee_dao),
) -> IDispatchService:
    return DispatchService(
        commande_dao=commande_dao,
        livreur_dao=livreur_dao,
        tournee_dao=tournee_dao,
    )


def get_livreur_service(
    livreur_dao: ILivreurDao = Depends(get_livreur_dao),
    blacklist_service: IClientBlacklistService = Depends(get_blacklist_service),
    dispatch_service: IDispatchService = Depends(get_dispatch_service),
) -> ILivreurService:
    return LivreurService(
        livreur_dao=livreur_dao,
        client_blacklist_service=blacklist_service,
        dispatch_service=dispatch_service,
    )


def get_fournisseur_service(
    fournisseur_dao: IFournisseurDao = Depends(get_fournisseur_dao),
    fournisseur_produit_dao: IFournisseurProduitDao = Depends(get_fournisseur_produit_dao),
) -> IFournisseurService:
    return FournisseurService(
        fournisseur_dao=fournisseur_dao,
        fournisseur_produit_dao=fournisseur_produit_dao,
    )


def get_fournisseur_produit_service(
    dao: IFournisseurProduitDao = Depends(get_fournisseur_produit_dao),
) -> IFournisseurProduitService:
    return FournisseurProduitService(fournisseur_produit_dao=dao)


def get_panier_service(
    panier_dao: IPanierDao = Depends(get_panier_dao)
) -> IPanierService:
    return PanierService(panier_dao)


def get_parrainage_dao() -> IParrainageDao:
    return ParrainageDaoBD()


def get_ml_panier_service(
    panier_dao: IPanierDao = Depends(get_panier_dao),
) -> MLPanierService:
    ml_panier_service.configure_panier_dao(panier_dao)
    return ml_panier_service


def get_dish_composition_service(
    product_dao: IProductDao = Depends(get_product_dao),
) -> DishCompositionService:
    dish_composition_service.product_dao = product_dao
    return dish_composition_service


def get_souki_wallet_service(
    souki_wallet_dao: ISoukiWalletDao = Depends(get_souki_wallet_dao)
) -> ISoukiWalletService:
    return SoukiWalletService(souki_wallet_dao)


def get_parrainage_service(
    parrainage_dao: IParrainageDao = Depends(get_parrainage_dao),
    souki_wallet_service: ISoukiWalletService = Depends(get_souki_wallet_service),
) -> IParrainageService:
    return ParrainageService(parrainage_dao, souki_wallet_service)


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
