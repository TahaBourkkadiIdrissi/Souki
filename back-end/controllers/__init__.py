from controllers.auth_controller import auth_router
from controllers.profile_controller import profile_router
from controllers.catalogue_controller import router_catalogue
from controllers.claim_controller import claim_router
from controllers.commande_controller import router_voice
from controllers.dispatch_controller import dispatch_router
from controllers.livreur_controller import router_livreur
from controllers.admin_controller import admin_router, api_admin_router

__all__ = [
    "auth_router",
    "profile_router",
    "router_catalogue",
    "claim_router",
    "router_voice",
    "dispatch_router",
    "router_livreur",
    "admin_router",
    "api_admin_router",
]
