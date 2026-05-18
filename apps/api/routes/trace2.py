"""Trace2 domain routes.

POST /trace2/batch-header — proxy to V1 (legacy-api, browser-verified).
POST /trace2/trace-graph  — native Databricks WITH RECURSIVE lineage graph.
"""
import os
import httpx
from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, field_validator

from adapters.trace2.trace2_databricks_adapter import (
    TraceGraphRequest,
    get_trace_graph_recursive_spec,
    map_trace_graph,
)
from routes._databricks import (
    build_user_identity,
    require_databricks_config,
    run_query,
    set_databricks_response_headers,
)

router = APIRouter()

_V1_BASE_URL = os.getenv("V1_TRACE_API_BASE_URL", "")
_VALID_DIRECTIONS = {"upstream", "downstream", "both"}


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


# ---------------------------------------------------------------------------
# POST /trace2/trace-graph — native Databricks multi-hop lineage graph
# ---------------------------------------------------------------------------

class TraceGraphBody(BaseModel):
    material_id: str
    batch_id: str
    plant_id: str = ""
    direction: str = "both"
    max_depth: int = 3
    max_edges: int = 1000

    @field_validator("direction")
    @classmethod
    def _validate_direction(cls, v: str) -> str:
        if v not in _VALID_DIRECTIONS:
            raise ValueError(f"direction must be one of {sorted(_VALID_DIRECTIONS)}")
        return v


@router.post("/trace2/trace-graph")
async def trace_graph(
    body: TraceGraphBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    """POST /api/trace2/trace-graph — WITH RECURSIVE batch lineage graph.

    Only available in databricks-api mode. No legacy-api fallback. No mock fallback.
    Single SQL call against gold_batch_lineage; server-side traversal up to max_depth hops.
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="trace-graph requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    # Clamp depth and edge limits to safe bounds.
    # Hard cap at 4 — conservative pending UAT verification of WITH RECURSIVE on dense graphs.
    max_depth = min(max(body.max_depth, 1), 4)
    max_edges = min(max(body.max_edges, 1), 5000)

    request = TraceGraphRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        plant_id=body.plant_id,
        direction=body.direction,
        max_depth=max_depth,
        max_edges=max_edges,
    )

    rows, spec = await run_query(
        lambda: get_trace_graph_recursive_spec(request),
        identity, host, warehouse_id,
    )

    tagged_rows: list[tuple[dict, int, str]] = []
    seen_edge_keys: set[str] = set()
    depth_reached = 0
    truncated = False

    for row in rows:
        if len(seen_edge_keys) >= max_edges:
            truncated = True
            break
        hop = int(row.get("hop_depth") or 1)
        traversal_dir = str(row.get("traversal_dir") or "downstream")
        link_type = row.get("link_type") or ""
        doc_num = row.get("material_document_number") or ""
        parent_key = f"{row['parent_material_id']}:{row['parent_batch_id']}"
        child_key = f"{row['child_material_id']}:{row['child_batch_id']}"
        edge_key = f"{parent_key}|{child_key}|{link_type}|{doc_num}|{hop}"
        if edge_key not in seen_edge_keys:
            seen_edge_keys.add(edge_key)
            tagged_rows.append((row, hop - 1, traversal_dir))
            if hop > depth_reached:
                depth_reached = hop

    graph = map_trace_graph(tagged_rows, request, depth_reached, truncated)
    set_databricks_response_headers(response, spec)
    return graph
