"""Thin proxy routes for the Process Order Review domain — forwards requests to the V1 POH backend."""
import os
import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

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
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 process order header endpoint."""
    return await _forward_post(
        "/api/por/order-header",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )
