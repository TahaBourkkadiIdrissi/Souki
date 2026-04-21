import uvicorn
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

import entities
from config import Base, engine
from controllers.admin_controller import admin_router
from controllers.auth_controller import auth_router
from controllers.catalogue_controller import router_catalogue
from controllers.checkout_controller import router_checkout
from controllers.commande_controller import router_voice
from controllers.livreur_controller import router_livreur
from controllers.panier_controller import router_panier
from controllers.profile_controller import profile_router
from services.catalogue_bootstrap_service import CatalogueBootstrapService
from services.rbac_bootstrap_service import RBACBootstrapService

# Initialisation DB
Base.metadata.create_all(bind=engine)
RBACBootstrapService().sync_rbac()
CatalogueBootstrapService().sync_catalogue()

app = FastAPI(title="Fes Delivery Professional API")


def get_allowed_origins() -> list[str]:
    configured_origins = os.getenv("FRONTEND_ORIGINS")
    if configured_origins:
        return [origin.strip() for origin in configured_origins.split(",") if origin.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- NOUVEAU : Intercepteur d'erreurs de validation ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # On extrait uniquement tes messages personnalisés ("msg")
    error_messages = [err.get("msg") for err in exc.errors()]
    
    # On renvoie une erreur 422 avec un texte propre (joint par des tirets si plusieurs erreurs)
    return JSONResponse(
        status_code=422,
        content={"detail": " | ".join(error_messages)}
    )
# ------------------------------------------------------

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(router_catalogue)
app.include_router(router_voice)
app.include_router(router_panier)
app.include_router(router_checkout)
app.include_router(router_livreur)
app.include_router(admin_router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
