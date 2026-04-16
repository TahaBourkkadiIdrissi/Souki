import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import Base, engine
from controllers import auth_router, profile_router, router_voice, router_catalogue

# Initialisation DB
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fès Delivery Professional API")

# Configuration des CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Remplace par le port de ton frontend si différent
    allow_credentials=True,
    allow_methods=["*"],  # Autorise POST, GET, OPTIONS, etc.
    allow_headers=["*"],  # Autorise tous les headers (notamment l'Authorization pour le token)
)

# Inclusion des routers
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(router_voice)
app.include_router(router_catalogue)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)