"""Thin proxy routes for the Connected Quality Lab domain — forwards requests to the V1 CQ backend."""
import os
import httpx
from fastapi import APIRouter, Header, HTTPException

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
    """Proxy to V1 CQ lab fails endpoint."""
    params: dict[str, str] = {}
    if plant_id:
        params["plant_id"] = plant_id
    if lot_type:
        params["lot_type"] = lot_type
    return await _forward_get("/api/cq/lab/fails", params, x_forwarded_access_token)


@router.get("/cq/lab/plants")
async def lab_plants(
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 CQ lab plants endpoint."""
    return await _forward_get("/api/cq/lab/plants", {}, x_forwarded_access_token)
