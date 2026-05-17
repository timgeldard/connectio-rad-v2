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
    OrderConfirmationsRequest,
    OrderGoodsMovementsRequest,
    OrderOperationsRequest,
    ProcessOrderHeaderRequest,
    get_order_confirmations_spec,
    get_order_goods_movements_spec,
    get_order_operations_spec,
    get_process_order_header_spec,
    map_order_confirmations_rows,
    map_order_goods_movements_rows,
    map_order_operations_rows,
    map_process_order_header_rows,
)
from routes._databricks import (
    build_user_identity,
    require_databricks_config,
    run_query,
    set_databricks_response_headers,
)

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
    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(token, user, email)
    rows, spec = await run_query(
        lambda: get_process_order_header_spec(
            ProcessOrderHeaderRequest(
                process_order_id=body.process_order_id,
                plant_id=body.plant_id,
            )
        ),
        identity, host, warehouse_id,
    )

    result = map_process_order_header_rows(rows)
    if result is None:
        raise HTTPException(status_code=404, detail="Process order not found")

    set_databricks_response_headers(response, spec)
    return result


@router.get("/por/order-operations")
async def order_operations(
    process_order_id: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list:
    """Process order operations (phases) — databricks-api only.

    No V1 endpoint exists for this data. Returns 503 if BACKEND_ADAPTER_MODE
    is not databricks-api. Missing OAuth → 401. Missing config → 503.
    No silent fallback.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Order operations require BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_query(
        lambda: get_order_operations_spec(OrderOperationsRequest(process_order_id=process_order_id)),
        identity, host, warehouse_id,
    )
    set_databricks_response_headers(response, spec)
    return map_order_operations_rows(rows)


@router.get("/por/order-confirmations")
async def order_confirmations(
    process_order_id: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list:
    """Process order confirmations — databricks-api only.

    No V1 endpoint exists for this data. Returns 503 if BACKEND_ADAPTER_MODE
    is not databricks-api. Missing OAuth → 401. Missing config → 503.

    Source view: vw_gold_confirmation (connected_plant_uat.csm_process_order_history)
    DDL confirmed 2026-05-17. operationText and isFinalConfirmation absent from view.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Order confirmations require BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_query(
        lambda: get_order_confirmations_spec(OrderConfirmationsRequest(process_order_id=process_order_id)),
        identity, host, warehouse_id,
    )
    set_databricks_response_headers(response, spec)
    return map_order_confirmations_rows(rows)


@router.get("/por/order-goods-movements")
async def order_goods_movements(
    process_order_id: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list:
    """Process order goods movements (ADP) — databricks-api only.

    No V1 endpoint exists for this data. Returns 503 if BACKEND_ADAPTER_MODE
    is not databricks-api. Missing OAuth → 401. Missing config → 503.

    Source view: vw_gold_adp_movement (connected_plant_uat.csm_process_order_history)
    DDL confirmed 2026-05-17. materialDescription absent from view.
    direction derived from MOVEMENT_TYPE — update _MOVEMENT_DIRECTION_MAP once
    confirmed ADP movement type values are known.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Order goods movements require BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_query(
        lambda: get_order_goods_movements_spec(OrderGoodsMovementsRequest(process_order_id=process_order_id)),
        identity, host, warehouse_id,
    )
    set_databricks_response_headers(response, spec)
    return map_order_goods_movements_rows(rows)
