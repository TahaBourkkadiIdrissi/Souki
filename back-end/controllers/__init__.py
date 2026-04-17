from .auth_controller import auth_router
from .profile_controller import profile_router
from .catalogue_controller import router_catalogue
from .commande_controller import router_voice

__all__ = ["auth_router", "profile_router", "router_catalogue", "router_voice"]
