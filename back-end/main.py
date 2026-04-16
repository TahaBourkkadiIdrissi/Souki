import uvicorn
from fastapi import FastAPI
from config import Base, engine
from controllers import auth_router, profile_router,router_voice, router_catalogue
from fastapi.middleware.cors import CORSMiddleware 

# Initialisation DB
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fès Delivery Professional API")

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(router_voice)
app.include_router(router_catalogue)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Autorise ton frontend Next.js
    allow_credentials=True,
    allow_methods=["*"], # Autorise toutes les méthodes (GET, POST...)
    allow_headers=["*"], # Autorise tous les headers
)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)