"""Trace2 domain routes.

POST /trace2/batch-header — proxy to V1 (legacy-api, browser-verified).
POST /trace2/trace-graph  — native Databricks iterative multi-hop graph (q.txt).
"""
import os
import httpx
from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, field_validator

from adapters.trace2.trace2_databricks_adapter import (
    TraceGraphRequest,
    get_trace_graph_anchor_spec,
    get_trace_graph_hop_spec,
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
    plant_id: str
    direction: str = "both"
    max_depth: int = 6
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
    """POST /api/trace2/trace-graph — iterative multi-hop batch lineage graph.

    Only available in databricks-api mode. No legacy-api fallback. No mock fallback.
    Iterates depth hops over gold_batch_lineage using one QuerySpec per hop.
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

    # Clamp depth and edge limits to safe bounds
    max_depth = min(max(body.max_depth, 1), 10)
    max_edges = min(max(body.max_edges, 1), 5000)

    request = TraceGraphRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        plant_id=body.plant_id,
        direction=body.direction,
        max_depth=max_depth,
        max_edges=max_edges,
    )

    anchor_key = f"{body.material_id}:{body.batch_id}:{body.plant_id}"
    seen_node_keys: set[str] = {anchor_key}
    seen_edge_keys: set[str] = set()
    tagged_rows: list[tuple[dict, int, str]] = []
    truncated = False
    depth_reached = 0
    last_spec = None

    # ---- Hop 0: anchor spec (bound params — user input) ----
    rows0, spec0 = await run_query(
        lambda: get_trace_graph_anchor_spec(request),
        identity, host, warehouse_id,
    )
    last_spec = spec0

    next_frontier: set[tuple[str, str, str]] = set()
    for row in rows0:
        if len(seen_edge_keys) >= max_edges:
            truncated = True
            break
        parent_key = f"{row['parent_material_id']}:{row['parent_batch_id']}:{row['parent_plant_id']}"
        child_key = f"{row['child_material_id']}:{row['child_batch_id']}:{row['child_plant_id']}"
        # Classify edge direction: parent==anchor means anchor produced child → downstream
        edge_dir = "downstream" if parent_key == anchor_key else "upstream"
        link_type = row.get("link_type") or ""
        doc_num = row.get("material_document_number") or ""
        edge_key = f"{parent_key}|{child_key}|{link_type}|{doc_num}|0"
        if edge_key not in seen_edge_keys:
            seen_edge_keys.add(edge_key)
            tagged_rows.append((row, 0, edge_dir))
            # Collect new frontier: the end that is NOT the anchor
            if edge_dir == "downstream" and child_key not in seen_node_keys:
                seen_node_keys.add(child_key)
                next_frontier.add((
                    row["child_material_id"],
                    row["child_batch_id"],
                    row["child_plant_id"],
                ))
            elif edge_dir == "upstream" and parent_key not in seen_node_keys:
                seen_node_keys.add(parent_key)
                next_frontier.add((
                    row["parent_material_id"],
                    row["parent_batch_id"],
                    row["parent_plant_id"],
                ))

    if rows0:
        depth_reached = 1

    # ---- Hops 1..max_depth-1: hop spec (embedded literals — server values) ----
    frontier = list(next_frontier)
    for hop in range(1, max_depth):
        if not frontier or truncated:
            break

        captured_frontier = frontier  # capture for lambda default arg
        rows_n, spec_n = await run_query(
            lambda f=captured_frontier: get_trace_graph_hop_spec(f, body.direction),
            identity, host, warehouse_id,
        )
        last_spec = spec_n

        next_frontier = set()
        for row in rows_n:
            if len(seen_edge_keys) >= max_edges:
                truncated = True
                break
            parent_key = f"{row['parent_material_id']}:{row['parent_batch_id']}:{row['parent_plant_id']}"
            child_key = f"{row['child_material_id']}:{row['child_batch_id']}:{row['child_plant_id']}"

            # Skip edges where both endpoints are already seen (cycle prevention)
            if parent_key in seen_node_keys and child_key in seen_node_keys:
                continue

            # Classify direction by which end was already in the graph
            if parent_key in seen_node_keys:
                edge_dir = "downstream"
                if child_key not in seen_node_keys:
                    seen_node_keys.add(child_key)
                    next_frontier.add((
                        row["child_material_id"],
                        row["child_batch_id"],
                        row["child_plant_id"],
                    ))
            else:
                edge_dir = "upstream"
                if parent_key not in seen_node_keys:
                    seen_node_keys.add(parent_key)
                    next_frontier.add((
                        row["parent_material_id"],
                        row["parent_batch_id"],
                        row["parent_plant_id"],
                    ))

            link_type = row.get("link_type") or ""
            doc_num = row.get("material_document_number") or ""
            edge_key = f"{parent_key}|{child_key}|{link_type}|{doc_num}|{hop}"
            if edge_key not in seen_edge_keys:
                seen_edge_keys.add(edge_key)
                tagged_rows.append((row, hop, edge_dir))

        if rows_n:
            depth_reached = hop + 1
        frontier = list(next_frontier)

    graph = map_trace_graph(tagged_rows, request, depth_reached, truncated)
    set_databricks_response_headers(response, last_spec or spec0)
    return graph
