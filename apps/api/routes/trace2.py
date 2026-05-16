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


class Trace2Request(BaseModel):
    investigation_id: str | None = None
    batch_id: str | None = None
    material_id: str | None = None
    plant_id: str | None = None


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


@router.post("/trace2/investigation-context")
async def investigation_context(
    body: Trace2Request,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 investigation context endpoint."""
    return await _forward_post(
        "/api/t2/investigation-context",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/trace2/trace-graph")
async def trace_graph(
    body: Trace2Request,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 trace graph endpoint."""
    return await _forward_post(
        "/api/t2/trace-graph",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/trace2/mass-balance")
async def mass_balance(
    body: Trace2Request,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 mass balance endpoint."""
    return await _forward_post(
        "/api/t2/mass-balance",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/trace2/customer-exposure")
async def customer_exposure(
    body: Trace2Request,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 customer exposure endpoint."""
    return await _forward_post(
        "/api/t2/customer-exposure",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/trace2/supplier-exposure")
async def supplier_exposure(
    body: Trace2Request,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 supplier exposure endpoint."""
    return await _forward_post(
        "/api/t2/supplier-exposure",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/trace2/event-timeline")
async def event_timeline(
    body: Trace2Request,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 event timeline endpoint."""
    return await _forward_post(
        "/api/t2/event-timeline",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/trace2/coa-release")
async def coa_release(
    body: Trace2Request,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 CoA release status endpoint."""
    return await _forward_post(
        "/api/t2/coa-release",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/trace2/risk-signals")
async def risk_signals(
    body: Trace2Request,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 risk signals endpoint."""
    return await _forward_post(
        "/api/t2/risk-signals",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/trace2/related-investigations")
async def related_investigations(
    body: Trace2Request,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 related investigations endpoint."""
    return await _forward_post(
        "/api/t2/related-investigations",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/trace2/trace-exposure")
async def trace_exposure(
    body: Trace2Request,
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Proxy to V1 trace exposure for release endpoint."""
    return await _forward_post(
        "/api/t2/trace-exposure",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )
