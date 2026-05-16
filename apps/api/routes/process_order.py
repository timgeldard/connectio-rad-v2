"""Routes for the Process Order Review domain.

Default mode (``BACKEND_ADAPTER_MODE=legacy-api``): forwards requests to the
V1 POH backend unchanged.

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

from adapters.poh.poh_databricks_adapter import (
    ProcessOrderHeaderRequest,
    get_process_order_header_spec,
    map_process_order_header_rows,
)
from shared.query_service.databricks_client import StatementApiDatabricksClient
from shared.query_service.errors import (
    DatabricksAuthRequiredError,
    DatabricksQueryError,
    DatabricksQueryTimeoutError,
)
from shared.query_service.identity import UserIdentity
from shared.query_service.query_executor import QueryExecutor

router = APIRouter()

_V1_BASE_URL = os.getenv("V1_POH_API_BASE_URL", "")


class OrderHeaderRequest(BaseModel):
    process_order_id: str
    plant_id: str | None = None


async def _forward_post(v1_path: str, body: dict, token: str | None) -> dict:
    if not _V1_BASE_URL:
        raise HTTPException(status_code=503, detail="V1_POH_API_BASE_URL is not configured")

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


@router.post("/por/order-header")
async def order_header(
    body: OrderHeaderRequest,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    """Process order header — supports legacy-api and databricks-api modes.

    ``BACKEND_ADAPTER_MODE=databricks-api`` switches to native Databricks SQL.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")

    if backend_mode == "databricks-api":
        return await _order_header_databricks(
            body, response, x_forwarded_access_token, x_forwarded_user, x_forwarded_email
        )

    return await _forward_post(
        "/api/por/order-header",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


async def _order_header_databricks(
    body: OrderHeaderRequest,
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
        spec = get_process_order_header_spec(
            ProcessOrderHeaderRequest(
                process_order_id=body.process_order_id,
                plant_id=body.plant_id,
            )
        )
        client = StatementApiDatabricksClient(host=databricks_host)
        executor = QueryExecutor(client=client, warehouse_id=warehouse_id)
        rows = await executor.execute(spec, identity)
    except DatabricksAuthRequiredError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except DatabricksQueryTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except DatabricksQueryError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    result = map_process_order_header_rows(rows)
    if result is None:
        raise HTTPException(status_code=404, detail="Process order not found")

    response.headers["X-Data-Source"] = spec.source_badge
    return result
