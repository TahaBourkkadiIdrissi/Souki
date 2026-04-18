import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import entities
from config import Base, engine
from controllers.auth_controller import auth_router
from controllers.profile_controller import profile_router
from controllers.catalogue_controller import router_catalogue
from controllers.commande_controller import router_voice

# Initialisation DB
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fès Delivery Professional API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)