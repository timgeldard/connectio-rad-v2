"""Thin proxy routes for the Trace2 domain — forwards requests to the V1 FastAPI backend."""
import os
import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter()

_V1_BASE_URL = os.getenv("V1_TRACE_API_BASE_URL", "")


class BatchRequest(BaseModel):
    material_id: str
    batch_id: str


async def _forward_post(v1_path: str, body: dict, token: str | None) -> dict:
    if not _V1_BASE_URL:
        raise HTTPException(status_code=503, detail="V1_TRACE_API_BASE_URL is not configured")

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


@router.post("/trace2/batch-header")
async def batch_header(
    body: BatchRequest,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 POST /api/t2/batch-header."""
    return await _forward_post(
        "/api/t2/batch-header",
        body.model_dump(),
        x_forwarded_access_token,
    )
