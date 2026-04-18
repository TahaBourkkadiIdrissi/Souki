import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import entities
from config import Base, engine
from controllers.auth_controller import auth_router
from controllers.catalogue_controller import router_catalogue
from controllers.checkout_controller import router_checkout
from controllers.commande_controller import router_voice
from controllers.profile_controller import profile_router
from services.catalogue_bootstrap_service import CatalogueBootstrapService

# Initialisation DB
Base.metadata.create_all(bind=engine)
CatalogueBootstrapService().sync_catalogue()

app = FastAPI(title="Fes Delivery Professional API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(router_catalogue)
app.include_router(router_voice)
app.include_router(router_checkout)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
