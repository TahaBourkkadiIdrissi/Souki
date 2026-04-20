import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

import entities
from config import Base, engine
from controllers.auth_controller import auth_router
from controllers.catalogue_controller import router_catalogue
from controllers.checkout_controller import router_checkout
from controllers.commande_controller import router_voice
from controllers.panier_controller import router_panier
from controllers.profile_controller import profile_router
from controllers.jit_controller import router_jit
from services.catalogue_bootstrap_service import CatalogueBootstrapService
from services.scheduler_service import start_scheduler, stop_scheduler

# Initialisation DB
Base.metadata.create_all(bind=engine)
CatalogueBootstrapService().sync_catalogue()


# --- LIFESPAN EVENTS (Moderne - FastAPI 0.93+) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gère le cycle de vie de l'application (startup et shutdown)"""
    # Startup
    print("\n🚀 Démarrage de l'application SOUKI...")
    start_scheduler()
    print("✅ Application SOUKI lancée avec succès\n")
    
    yield  # L'application tourne ici
    
    # Shutdown
    print("\n🛑 Arrêt de l'application SOUKI...")
    stop_scheduler()
    print("✅ Application SOUKI arrêtée\n")
# ---------------------------------------------------


app = FastAPI(title="Fes Delivery Professional API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Intercepteur d'erreurs de validation ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # On extrait uniquement tes messages personnalisés ("msg")
    error_messages = [err.get("msg") for err in exc.errors()]
    
    # On renvoie une erreur 422 avec un texte propre (joint par des tirets si plusieurs erreurs)
    return JSONResponse(
        status_code=422,
        content={"detail": " | ".join(error_messages)}
    )
# --------------------------------------------------

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(router_catalogue)
app.include_router(router_voice)
app.include_router(router_panier)
app.include_router(router_checkout)
app.include_router(router_jit)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)