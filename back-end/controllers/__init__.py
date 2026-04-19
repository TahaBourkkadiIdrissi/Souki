from controllers.auth_controller import auth_router
from controllers.profile_controller import profile_router
from controllers.catalogue_controller import router_catalogue
from controllers.commande_controller import router_voice
from controllers.livreur_controller import router_livreur

__all__ = ["auth_router", "profile_router", "router_catalogue", "router_voice", "router_livreur"]
