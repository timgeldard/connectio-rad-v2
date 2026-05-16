"""Routes for the Connected Quality Lab domain.

Default mode (``BACKEND_ADAPTER_MODE=legacy-api``): forwards requests to the
V1 CQ backend.

Databricks mode (``BACKEND_ADAPTER_MODE=databricks-api``): the ``/cq/lab/plants``
endpoint executes SQL directly against Unity Catalog using the user's OAuth token.
``/cq/lab/fails`` remains legacy-api only (blocked — see cq_databricks_adapter.py).
Missing OAuth in databricks-api mode → HTTP 401. Missing config → HTTP 503.
No silent fallback.
"""
from __future__ import annotations

import os

import httpx
from fastapi import APIRouter, Header, HTTPException, Response

from adapters.cq.cq_databricks_adapter import get_lab_plants_spec, map_lab_plants_rows
from shared.query_service.databricks_client import StatementApiDatabricksClient
from shared.query_service.errors import (
    DatabricksAuthRequiredError,
    DatabricksQueryError,
    DatabricksQueryTimeoutError,
)
from shared.query_service.identity import UserIdentity
from shared.query_service.query_executor import QueryExecutor

router = APIRouter()

_V1_CQ_BASE_URL = os.getenv("V1_CQ_API_BASE_URL", "")


async def _forward_get(v1_path: str, params: dict, token: str | None) -> dict:
    if not _V1_CQ_BASE_URL:
        raise HTTPException(status_code=503, detail="V1_CQ_API_BASE_URL is not configured")

    headers: dict[str, str] = {}
    if token:
        headers["x-forwarded-access-token"] = token

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{_V1_CQ_BASE_URL}{v1_path}", params=params, headers=headers
            )
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        raise HTTPException(status_code=502, detail=f"Upstream unreachable: {exc}") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Upstream returned 401 Unauthorized")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Upstream returned 404 Not Found")
    if not response.is_success:
        raise HTTPException(status_code=502, detail=f"Upstream returned {response.status_code}")

    return response.json()


@router.get("/cq/lab/fails")
async def lab_fails(
    plant_id: str | None = None,
    lot_type: str | None = None,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 CQ lab fails endpoint. Always legacy-api — databricks path blocked."""
    params: dict[str, str] = {}
    if plant_id:
        params["plant_id"] = plant_id
    if lot_type:
        params["lot_type"] = lot_type
    return await _forward_get("/api/cq/lab/fails", params, x_forwarded_access_token)


@router.get("/cq/lab/plants")
async def lab_plants(
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    """Lab plants list — supports legacy-api and databricks-api modes.

    ``BACKEND_ADAPTER_MODE=databricks-api`` queries gold_plant directly.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")

    if backend_mode == "databricks-api":
        return await _lab_plants_databricks(
            response, x_forwarded_access_token, x_forwarded_user, x_forwarded_email
        )

    return await _forward_get("/api/cq/lab/plants", {}, x_forwarded_access_token)


async def _lab_plants_databricks(
    response: Response,
    token: str | None,
    user: str | None,
    email: str | None,
) -> dict:
    databricks_host = os.getenv("DATABRICKS_HOST", "")
    warehouse_id = os.getenv("SQL_WAREHOUSE_ID", "")

    if not databricks_host or not warehouse_id:
        raise HTTPException(
            status_code=503,
            detail=(
                "DATABRICKS_HOST and SQL_WAREHOUSE_ID must be configured "
                "for BACKEND_ADAPTER_MODE=databricks-api"
            ),
        )

    identity = UserIdentity(
        user_id=user or "unknown",
        email=email,
        raw_oauth_token=token,
    )

    try:
        spec = get_lab_plants_spec()
        client = StatementApiDatabricksClient(host=databricks_host)
        executor = QueryExecutor(client=client, warehouse_id=warehouse_id)
        rows = await executor.execute(spec, identity)
    except DatabricksAuthRequiredError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except DatabricksQueryTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except DatabricksQueryError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    result = map_lab_plants_rows(rows)
    response.headers["X-Data-Source"] = spec.source_badge
    return result
