import uvicorn
from fastapi import FastAPI
from config import Base, engine
from controllers import auth_router, profile_router

# Initialisation DB
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fès Delivery Professional API")

app.include_router(auth_router)
app.include_router(profile_router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)