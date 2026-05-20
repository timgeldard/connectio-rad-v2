"""Routes for the SPC (Statistical Process Control) domain.

Default mode (``BACKEND_ADAPTER_MODE=legacy-api``): forwards requests to the
V1 SPC FastAPI backend at ``V1_SPC_API_BASE_URL``.

Databricks mode (``BACKEND_ADAPTER_MODE=databricks-api``): not yet implemented;
returns 503. The SPC databricks adapter should query gold views directly once
fully verified.

Proxy routes wired here (NOT yet browser-verified against live V1 UAT):
  GET  /spc/materials      → V1 /api/spc/materials
  GET  /spc/plants         → V1 /api/spc/plants?material_id=...
  GET  /spc/characteristics → V1 /api/spc/characteristics?material_id=...&plant_id=...
  POST /spc/chart-data     → V1 /api/spc/chart-data

These routes will remain in "wired but not browser-verified" state until end-to-end
testing against a live V1 SPC UAT deployment is complete.

Auth: end-user Bearer token forwarded via x-forwarded-access-token header.
No service-principal fallback for user-facing reads (Databricks identity policy).
"""
from __future__ import annotations

import os
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()

_V1_BASE_URL = os.getenv("V1_SPC_API_BASE_URL", "")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _require_v1_base_url() -> str:
    """Raise 503 if V1_SPC_API_BASE_URL is not configured."""
    if not _V1_BASE_URL:
        raise HTTPException(
            status_code=503,
            detail="V1_SPC_API_BASE_URL is not configured. "
                   "Set this env var to the V1 SPC FastAPI app URL.",
        )
    return _V1_BASE_URL


def _auth_headers(token: str | None) -> dict:
    headers = {"Accept": "application/json"}
    if token:
        headers["x-forwarded-access-token"] = token
    return headers


async def _forward_get(path: str, params: dict, token: str | None) -> dict | list:
    base = _require_v1_base_url()
    # Strip None values — httpx omits them automatically but be explicit
    clean_params = {k: v for k, v in params.items() if v is not None}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{base}{path}",
                params=clean_params,
                headers=_auth_headers(token),
            )
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        raise HTTPException(status_code=502, detail=f"V1 SPC upstream unreachable: {exc}") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="V1 SPC upstream returned 401 Unauthorized")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="V1 SPC upstream returned 404 Not Found")
    if not response.is_success:
        raise HTTPException(status_code=502, detail=f"V1 SPC upstream returned {response.status_code}")

    return response.json()


async def _forward_post(path: str, body: dict, token: str | None) -> dict | list:
    base = _require_v1_base_url()
    headers = {**_auth_headers(token), "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{base}{path}", json=body, headers=headers)
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        raise HTTPException(status_code=502, detail=f"V1 SPC upstream unreachable: {exc}") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="V1 SPC upstream returned 401 Unauthorized")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="V1 SPC upstream returned 404 Not Found")
    if not response.is_success:
        raise HTTPException(status_code=502, detail=f"V1 SPC upstream returned {response.status_code}")

    return response.json()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class ChartDataRequest(BaseModel):
    """Body for POST /spc/chart-data.

    Maps to V1 spc_backend router_charts.py chart-data endpoint.
    material_id and mic_id are required; plant_id and operation_id are optional
    but strongly recommended for index efficiency in V1 gold views.
    """
    material_id: str
    mic_id: str
    plant_id: Optional[str] = None
    operation_id: Optional[str] = None
    chart_type: Optional[str] = None


# ---------------------------------------------------------------------------
# Proxy routes
# ---------------------------------------------------------------------------


@router.get("/spc/materials")
async def spc_materials(
    x_forwarded_access_token: str | None = Header(default=None),
) -> list:
    """List all materials with SPC data.

    Proxies to V1 GET /api/spc/materials — queries spc_material_dim_mv.

    NOT YET BROWSER-VERIFIED: route is wired but has not been tested against
    a live V1 SPC UAT deployment.
    """
    _ensure_legacy_mode()
    return await _forward_get("/api/spc/materials", {}, x_forwarded_access_token)


@router.get("/spc/plants")
async def spc_plants(
    material_id: str = Query(..., description="SAP material number to filter plant list"),
    x_forwarded_access_token: str | None = Header(default=None),
) -> list:
    """List plants that have SPC data for the given material.

    Proxies to V1 GET /api/spc/plants?material_id=... — queries spc_plant_material_dim_mv.

    NOT YET BROWSER-VERIFIED: route is wired but has not been tested against
    a live V1 SPC UAT deployment.
    """
    _ensure_legacy_mode()
    return await _forward_get("/api/spc/plants", {"material_id": material_id}, x_forwarded_access_token)


@router.get("/spc/characteristics")
async def spc_characteristics(
    material_id: str = Query(..., description="SAP material number"),
    plant_id: str | None = Query(default=None, description="Plant ID (optional filter)"),
    x_forwarded_access_token: str | None = Header(default=None),
) -> list:
    """List monitored inspection characteristics (MICs) for a material.

    Proxies to V1 GET /api/spc/characteristics?material_id=...&plant_id=... —
    queries spc_characteristic_dim_mv.

    NOT YET BROWSER-VERIFIED: route is wired but has not been tested against
    a live V1 SPC UAT deployment.
    """
    _ensure_legacy_mode()
    return await _forward_get(
        "/api/spc/characteristics",
        {"material_id": material_id, "plant_id": plant_id},
        x_forwarded_access_token,
    )


@router.post("/spc/chart-data")
async def spc_chart_data(
    body: ChartDataRequest,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict | list:
    """Fetch subgroup chart data for a material/MIC combination.

    Proxies to V1 POST /api/spc/chart-data — queries spc_quality_metric_subgroup_v.
    Returns raw subgroup points; control limits are computed client-side in the
    V2 frontend (matching V1's calculations.runtime.ts strategy).

    NOT YET BROWSER-VERIFIED: route is wired but has not been tested against
    a live V1 SPC UAT deployment.
    """
    _ensure_legacy_mode()
    return await _forward_post("/api/spc/chart-data", body.model_dump(exclude_none=True), x_forwarded_access_token)


# ---------------------------------------------------------------------------
# Internal guard
# ---------------------------------------------------------------------------


def _ensure_legacy_mode() -> None:
    """Raise 503 if BACKEND_ADAPTER_MODE is not legacy-api (or unset).

    databricks-api mode is not yet implemented for SPC — it requires
    direct gold-view SQL queries that are pending UAT column verification.
    """
    mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if mode == "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="SPC in databricks-api mode is not yet implemented. "
                   "Set BACKEND_ADAPTER_MODE=legacy-api and configure V1_SPC_API_BASE_URL.",
        )
