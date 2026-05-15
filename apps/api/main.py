"""ConnectIO V2 FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.health import router as health_router
from routes.workspaces import router as workspaces_router
from routes.auth import router as auth_router

app = FastAPI(title="ConnectIO API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(workspaces_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
