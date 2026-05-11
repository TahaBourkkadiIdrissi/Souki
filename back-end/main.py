import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, SQLAlchemyError

import entities
from config import Base, engine
from controllers.admin_controller import admin_router
from controllers.auth_controller import auth_router
from controllers.catalogue_controller import router_catalogue
from controllers.claim_controller import claim_router
from controllers.checkout_controller import router_checkout
from controllers.commande_controller import router_voice
from controllers.dispatch_controller import dispatch_router
from controllers.jit_controller import router_jit
from controllers.livreur_controller import router_livreur
from controllers.panier_controller import router_panier
from controllers.profile_controller import profile_router
from controllers.settings_controller import settings_router
from services.catalogue_bootstrap_service import CatalogueBootstrapService
from services.delivery_schema_sync_service import DeliverySchemaSyncService
from services.dispatch_schema_sync_service import DispatchSchemaSyncService
from services.ml_panier_service import ml_panier_service
from services.rbac_bootstrap_service import RBACBootstrapService
from services.scheduler_service import start_scheduler, stop_scheduler
from services.supabase_storage_service import avatar_storage_service
from services.wallet_schema_sync_service import WalletSchemaSyncService


def initialize_application() -> None:
    try:
        Base.metadata.create_all(bind=engine)
        WalletSchemaSyncService.sync()
        DeliverySchemaSyncService.sync()
        DispatchSchemaSyncService.sync()
        avatar_storage_service.ensure_avatar_column()
    except OperationalError as exc:
        raise RuntimeError(
            "Connexion a la base impossible au demarrage. Verifie back-end/.env "
            "(user, password, host, port, dbname) ainsi que l'acces reseau a PostgreSQL/Supabase."
        ) from exc

    try:
        RBACBootstrapService().sync_rbac()
        CatalogueBootstrapService().sync_catalogue()
    except SQLAlchemyError as exc:
        raise RuntimeError(
            "L'initialisation de la base a echoue pendant le bootstrap des donnees."
        ) from exc

    avatar_storage_service.bootstrap_avatar_storage()



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown."""
    print("\n[STARTUP] Demarrage de l'application SOUKI...")
    ml_panier_service.load_model()
    if ml_panier_service.load_error:
        print(f"[STARTUP] Panier intelligent en mode fallback: {ml_panier_service.load_error}")
    else:
        print("[STARTUP] Modele panier intelligent charge")
    start_scheduler()
    print("[STARTUP] Application SOUKI lancee avec succes\n")

    yield

    print("\n[SHUTDOWN] Arret de l'application SOUKI...")
    stop_scheduler()
    ml_panier_service.unload_model()
    print("[SHUTDOWN] Application SOUKI arretee\n")


app = FastAPI(title="Fes Delivery Professional API", lifespan=lifespan)


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


def get_allowed_origin_regex() -> str:
    configured_regex = os.getenv("FRONTEND_ORIGIN_REGEX")
    if configured_regex:
        return configured_regex
    return r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=get_allowed_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_messages = [err.get("msg") for err in exc.errors()]
    return JSONResponse(
        status_code=422,
        content={"detail": " | ".join(error_messages)},
    )


app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(settings_router)
app.include_router(router_catalogue)
app.include_router(router_voice)
app.include_router(router_panier)
app.include_router(router_checkout)
app.include_router(claim_router)
app.include_router(dispatch_router)
app.include_router(router_jit)
app.include_router(router_livreur)
app.include_router(admin_router)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
