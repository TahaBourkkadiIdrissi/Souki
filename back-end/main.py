import logging
import os
import re
import sys
import time
from collections.abc import Callable, Iterable
from contextlib import asynccontextmanager
from dataclasses import dataclass

import uvicorn
from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, SQLAlchemyError

# Configure logging to ensure immediate output (bypasses buffering)
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    stream=sys.stdout,
)

import entities
from config import ACCESS_TOKEN_COOKIE_NAME, Base, engine
from controllers.admin_controller import admin_router, api_admin_router
from controllers.admin_exception_controller import router_admin_exceptions
from controllers.auth_controller import auth_router
from controllers.catalogue_controller import router_catalogue
from controllers.claim_controller import claim_router
from controllers.checkout_controller import router_checkout
from controllers.client_blacklist_controller import client_blacklist_router
from controllers.commande_controller import router_voice
from controllers.dispatch_controller import anomalies_router, dispatch_router
from controllers.fournisseur_controller import router_admin_supplier, router_supplier
from controllers.supplier_products_controller import router_supplier_products
from controllers.jit_controller import router_jit
from controllers.livreur_controller import router_livreur
from controllers.panier_controller import router_panier
from controllers.produit_pricing_controller import router as pricing_router
from controllers.profile_controller import profile_router
from controllers.settings_controller import settings_router
from controllers.zone_controller import router_admin_zones
from services.catalogue_bootstrap_service import CatalogueBootstrapService
from services.delivery_schema_sync_service import DeliverySchemaSyncService
from services.dispatch_schema_sync_service import DispatchSchemaSyncService
from services.jit_schema_sync_service import JITSchemaSyncService
from services.logistics_schema_sync_service import LogisticsSchemaSyncService
from services.perf_index_sync_service import PerfIndexSyncService
from services.rbac_bootstrap_service import RBACBootstrapService
from services.scheduler_service import start_scheduler, stop_scheduler
from services.supplier_schema_sync_service import SupplierSchemaSyncService
from services.fournisseur_produit_schema_sync_service import FournisseurProduitSchemaSyncService
from services.supabase_storage_service import avatar_storage_service
from services.wallet_schema_sync_service import WalletSchemaSyncService


API_ROUTERS: tuple[APIRouter, ...] = (
    auth_router,
    profile_router,
    settings_router,
    router_catalogue,
    router_voice,
    router_panier,
    router_checkout,
    client_blacklist_router,
    pricing_router,
    claim_router,
    dispatch_router,
    anomalies_router,
    router_jit,
    router_livreur,
    router_supplier,
    router_supplier_products,
    admin_router,
    api_admin_router,
    router_admin_supplier,
    router_admin_zones,
    router_admin_exceptions,
)


@dataclass(frozen=True)
class AppTask:
    name: str
    action: Callable[[], None]


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def run_tasks(tasks: Iterable[AppTask], phase: str) -> None:
    for task in tasks:
        started_at = time.perf_counter()
        print(f"[{phase}] {task.name}...")
        task.action()
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        print(f"[{phase}] {task.name} OK ({elapsed_ms:.0f} ms)")


def sync_database_schema() -> None:
    Base.metadata.create_all(bind=engine)
    run_tasks(
        (
            AppTask("wallet schema sync", WalletSchemaSyncService.sync),
            AppTask("delivery schema sync", DeliverySchemaSyncService.sync),
            AppTask("dispatch schema sync", DispatchSchemaSyncService.sync),
            AppTask("supplier schema sync", SupplierSchemaSyncService.sync),
            AppTask("logistics schema sync", LogisticsSchemaSyncService.sync),
            AppTask("fournisseur produits schema sync", FournisseurProduitSchemaSyncService.sync),
            AppTask("jit schema sync", JITSchemaSyncService.sync),
            AppTask("perf index sync", PerfIndexSyncService.sync),
            AppTask("avatar column sync", avatar_storage_service.ensure_avatar_column),
        ),
        "STARTUP",
    )


def bootstrap_database_data() -> None:
    run_tasks(
        (
            AppTask("RBAC bootstrap", RBACBootstrapService().sync_rbac),
            AppTask("catalogue bootstrap", CatalogueBootstrapService().sync_catalogue),
        ),
        "STARTUP",
    )


def initialize_application() -> None:
    if env_flag("SOUKI_SKIP_DB_INIT", False):
        print("[STARTUP] Initialisation base ignoree par SOUKI_SKIP_DB_INIT")
        return

    try:
        sync_database_schema()
    except OperationalError as exc:
        raise RuntimeError(
            "Connexion a la base impossible au demarrage. Verifie back-end/.env "
            "(user, password, host, port, dbname) ainsi que l'acces reseau a PostgreSQL/Supabase."
        ) from exc

    if env_flag("SOUKI_SKIP_DATA_BOOTSTRAP", False):
        print("[STARTUP] Bootstrap donnees ignore par SOUKI_SKIP_DATA_BOOTSTRAP")
    else:
        try:
            bootstrap_database_data()
        except SQLAlchemyError as exc:
            raise RuntimeError(
                "L'initialisation de la base a echoue pendant le bootstrap des donnees."
            ) from exc

    if env_flag("SOUKI_SKIP_STORAGE_BOOTSTRAP", False):
        print("[STARTUP] Bootstrap storage ignore par SOUKI_SKIP_STORAGE_BOOTSTRAP")
    else:
        avatar_storage_service.bootstrap_avatar_storage()


def get_startup_tasks() -> tuple[AppTask, ...]:
    tasks: list[AppTask] = [AppTask("initialisation application", initialize_application)]

    if env_flag("SOUKI_ENABLE_SCHEDULER", True):
        tasks.append(AppTask("scheduler", start_scheduler))
    else:
        print("[STARTUP] Scheduler ignore par SOUKI_ENABLE_SCHEDULER=0")

    return tuple(tasks)


def get_shutdown_tasks() -> tuple[AppTask, ...]:
    tasks: list[AppTask] = []

    if env_flag("SOUKI_ENABLE_SCHEDULER", True):
        tasks.append(AppTask("scheduler", stop_scheduler))

    return tuple(tasks)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ = app
    print("\n[STARTUP] Demarrage de l'application SOUKI...")
    run_tasks(get_startup_tasks(), "STARTUP")
    print("[STARTUP] Application SOUKI lancee avec succes\n")

    yield

    print("\n[SHUTDOWN] Arret de l'application SOUKI...")
    run_tasks(get_shutdown_tasks(), "SHUTDOWN")
    print("[SHUTDOWN] Application SOUKI arretee\n")


def is_production_environment() -> bool:
    return os.getenv("SOUKI_ENV", os.getenv("APP_ENV", "development")).strip().lower() in {
        "prod",
        "production",
    }


def get_allowed_origins() -> list[str]:
    configured_origins = os.getenv("FRONTEND_ORIGINS")
    if configured_origins:
        return [origin.strip() for origin in configured_origins.split(",") if origin.strip()]

    # RISK-004 : en production, la liste d'origines doit etre explicite.
    if is_production_environment():
        raise RuntimeError(
            "FRONTEND_ORIGINS est obligatoire en production (liste d'origines separees par des virgules)."
        )

    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]


def get_allowed_origin_regex() -> str | None:
    configured_regex = os.getenv("FRONTEND_ORIGIN_REGEX")
    if configured_regex:
        return configured_regex
    # RISK-004 : la regex localhost "tous ports" est reservee au developpement.
    if is_production_environment():
        return None
    return r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"


# Methodes et en-tetes effectivement utilises par le front et le mobile.
CORS_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
CORS_ALLOWED_HEADERS = ["Authorization", "Content-Type", "Cache-Control", "Pragma"]


def configure_cors(fastapi_app: FastAPI) -> None:
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=get_allowed_origins(),
        allow_origin_regex=get_allowed_origin_regex(),
        allow_credentials=True,
        allow_methods=CORS_ALLOWED_METHODS,
        allow_headers=CORS_ALLOWED_HEADERS,
    )


def register_csrf_protection(fastapi_app: FastAPI) -> None:
    """Protection CSRF des ecritures authentifiees par cookie (VULN-010).

    Quand l'authentification vient du cookie httpOnly, un site tiers peut forcer
    le navigateur a envoyer ce cookie. On refuse donc toute methode d'ecriture
    dont l'en-tete Origin (toujours envoye par les navigateurs sur les requetes
    cross-site) ne correspond pas a une origine frontend declaree. Les clients
    sans cookie (app mobile en Authorization: Bearer) ne sont pas concernes.
    """
    unsafe_methods = {"POST", "PUT", "PATCH", "DELETE"}
    allowed_origins = set(get_allowed_origins())
    origin_regex = get_allowed_origin_regex()
    compiled_regex = re.compile(origin_regex) if origin_regex else None

    @fastapi_app.middleware("http")
    async def csrf_origin_check(request: Request, call_next):
        if (
            request.method in unsafe_methods
            and request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
        ):
            origin = request.headers.get("origin")
            if origin and origin not in allowed_origins and not (
                compiled_regex and compiled_regex.match(origin)
            ):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Origine non autorisee."},
                )
        return await call_next(request)


def register_exception_handlers(fastapi_app: FastAPI) -> None:
    @fastapi_app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        _ = request
        error_messages = [err.get("msg") for err in exc.errors()]
        return JSONResponse(
            status_code=422,
            content={"detail": " | ".join(error_messages)},
        )


def register_performance_middleware(fastapi_app: FastAPI) -> None:
    slow_threshold_ms = int(os.getenv("SOUKI_SLOW_REQUEST_MS", "1000"))

    @fastapi_app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        started_at = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        response.headers["X-Process-Time-ms"] = f"{elapsed_ms:.0f}"

        if elapsed_ms >= slow_threshold_ms:
            print(
                f"[PERF] {request.method} {request.url.path} "
                f"a pris {elapsed_ms:.0f} ms"
            )

        return response


def register_routers(fastapi_app: FastAPI) -> None:
    for router in API_ROUTERS:
        fastapi_app.include_router(router)


def create_app() -> FastAPI:
    fastapi_app = FastAPI(title="Fes Delivery Professional API", lifespan=lifespan)
    configure_cors(fastapi_app)
    register_csrf_protection(fastapi_app)
    register_exception_handlers(fastapi_app)
    register_performance_middleware(fastapi_app)
    register_routers(fastapi_app)
    return fastapi_app


app = create_app()


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
