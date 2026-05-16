"""ConnectIO V2 FastAPI application entry point."""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routes.health import router as health_router
from routes.workspaces import router as workspaces_router
from routes.auth import router as auth_router
from routes.trace2 import router as trace2_router
from routes.warehouse360 import router as warehouse360_router
from routes.process_order import router as process_order_router

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
app.include_router(trace2_router, prefix="/api")
app.include_router(warehouse360_router, prefix="/api")
app.include_router(process_order_router, prefix="/api")

# Serve the React bundle as static files when deployed to Databricks Apps.
# The static/ directory is absent in local development (Vite serves the frontend directly).
# html=True is sufficient: the app navigates via URL search params (?workspace=X), so the
# server always receives GET / — there are no path-segment deep links that would need a
# catch-all route.
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
