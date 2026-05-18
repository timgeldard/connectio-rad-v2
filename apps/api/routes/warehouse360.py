"""Routes for the Warehouse 360 domain.

Default mode (``BACKEND_ADAPTER_MODE=legacy-api``): forwards requests to the
V1 WH360 backend unchanged.

Databricks mode (``BACKEND_ADAPTER_MODE=databricks-api``): executes SQL directly
against Unity Catalog using the authenticated user's OAuth token. Requires
``DATABRICKS_HOST`` and ``SQL_WAREHOUSE_ID`` to be set. Missing OAuth → HTTP 401.
Missing config → HTTP 503. No silent fallback to legacy-api or mock.
"""
from __future__ import annotations

import os

import httpx
from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel

from adapters.warehouse360.warehouse360_databricks_adapter import (
    WarehouseOverviewRequest,
    WarehouseInboundRequest,
    WarehouseOutboundRequest,
    WarehouseStagingRequest,
    WarehouseExceptionRequest,
    get_warehouse_overview_spec,
    get_warehouse_inbound_spec,
    get_warehouse_outbound_spec,
    get_warehouse_staging_spec,
    get_warehouse_exceptions_spec,
    map_warehouse_overview_rows,
    map_warehouse_inbound_rows,
    map_warehouse_outbound_rows,
    map_warehouse_staging_rows,
    map_warehouse_exceptions_rows,
)
from routes._databricks import (
    build_user_identity,
    require_databricks_config,
    run_query,
    set_databricks_response_headers,
)

router = APIRouter()

_V1_BASE_URL = os.getenv("V1_WH360_API_BASE_URL", "")


class WarehouseSummaryRequest(BaseModel):
    warehouse_id: str
    plant_id: str | None = None


async def _forward_post(v1_path: str, body: dict, token: str | None) -> dict:
    if not _V1_BASE_URL:
        raise HTTPException(status_code=503, detail="V1_WH360_API_BASE_URL is not configured")

    headers = {"Content-Type": "application/json"}
    if token:
        headers["x-forwarded-access-token"] = token

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{_V1_BASE_URL}{v1_path}", json=body, headers=headers)
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        raise HTTPException(status_code=502, detail=f"Upstream unreachable: {exc}") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Upstream returned 401 Unauthorized")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Upstream returned 404 Not Found")
    if not response.is_success:
        raise HTTPException(status_code=502, detail=f"Upstream returned {response.status_code}")

    return response.json()


@router.post("/wh360/warehouse-summary")
async def warehouse_summary(
    body: WarehouseSummaryRequest,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 warehouse summary endpoint."""
    return await _forward_post(
        "/api/wh360/warehouse-summary",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.get("/warehouse360/overview")
async def warehouse_overview(
    warehouse_id: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    """Get high-level warehouse cockpit summary metrics — databricks-api only.

    No V1 endpoint exists for this data. Returns 503 if BACKEND_ADAPTER_MODE
    is not databricks-api. Missing OAuth → 401. Missing config → 503.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse overview requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_query(
        lambda: get_warehouse_overview_spec(WarehouseOverviewRequest(warehouse_id=warehouse_id)),
        identity, host, db_warehouse_id,
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_overview_rows(rows, WarehouseOverviewRequest(warehouse_id=warehouse_id))


@router.get("/warehouse360/inbound")
async def warehouse_inbound(
    warehouse_id: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[dict]:
    """Get inbound PO/STO details — databricks-api only.

    No V1 endpoint exists for this data. Returns 503 if BACKEND_ADAPTER_MODE
    is not databricks-api. Missing OAuth → 401. Missing config → 503.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse inbound list requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_query(
        lambda: get_warehouse_inbound_spec(WarehouseInboundRequest(warehouse_id=warehouse_id)),
        identity, host, db_warehouse_id,
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_inbound_rows(rows)


@router.get("/warehouse360/outbound")
async def warehouse_outbound(
    warehouse_id: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[dict]:
    """Get outbound delivery details — databricks-api only.

    No V1 endpoint exists for this data. Returns 503 if BACKEND_ADAPTER_MODE
    is not databricks-api. Missing OAuth → 401. Missing config → 503.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse outbound list requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_query(
        lambda: get_warehouse_outbound_spec(WarehouseOutboundRequest(warehouse_id=warehouse_id)),
        identity, host, db_warehouse_id,
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_outbound_rows(rows)


@router.get("/warehouse360/staging")
async def warehouse_staging(
    warehouse_id: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[dict]:
    """Get production staging details — databricks-api only.

    No V1 endpoint exists for this data. Returns 503 if BACKEND_ADAPTER_MODE
    is not databricks-api. Missing OAuth → 401. Missing config → 503.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse staging list requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_query(
        lambda: get_warehouse_staging_spec(WarehouseStagingRequest(warehouse_id=warehouse_id)),
        identity, host, db_warehouse_id,
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_staging_rows(rows)


@router.get("/warehouse360/exceptions")
async def warehouse_exceptions(
    warehouse_id: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[dict]:
    """Get IM/WM reconciliation exceptions — databricks-api only.

    No V1 endpoint exists for this data. Returns 503 if BACKEND_ADAPTER_MODE
    is not databricks-api. Missing OAuth → 401. Missing config → 503.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse exceptions requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_query(
        lambda: get_warehouse_exceptions_spec(WarehouseExceptionRequest(warehouse_id=warehouse_id)),
        identity, host, db_warehouse_id,
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_exceptions_rows(rows)
