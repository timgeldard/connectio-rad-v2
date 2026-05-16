"""Thin proxy routes for the Warehouse 360 domain — forwards requests to the V1 WMS backend."""
import os
import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter()

_V1_BASE_URL = os.getenv("V1_WH360_API_BASE_URL", "")


class WarehouseRequest(BaseModel):
    warehouse_id: str
    plant_id: str | None = None
    storage_location_id: str | None = None


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
    body: WarehouseRequest,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 warehouse summary endpoint."""
    return await _forward_post(
        "/api/wh360/warehouse-summary",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/wh360/context")
async def warehouse_context(
    body: WarehouseRequest,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 warehouse overview context endpoint."""
    return await _forward_post(
        "/api/wh360/context",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/wh360/stock-overview")
async def stock_overview(
    body: WarehouseRequest,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 stock overview endpoint."""
    return await _forward_post(
        "/api/wh360/stock-overview",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/wh360/open-holds")
async def open_holds(
    body: WarehouseRequest,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 open holds endpoint."""
    return await _forward_post(
        "/api/wh360/open-holds",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/wh360/goods-movements")
async def goods_movements(
    body: WarehouseRequest,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 goods movements endpoint."""
    return await _forward_post(
        "/api/wh360/goods-movements",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/wh360/replenishment-needs")
async def replenishment_needs(
    body: WarehouseRequest,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 replenishment needs endpoint."""
    return await _forward_post(
        "/api/wh360/replenishment-needs",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/wh360/location-capacities")
async def location_capacities(
    body: WarehouseRequest,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 location capacities endpoint."""
    return await _forward_post(
        "/api/wh360/location-capacities",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )
