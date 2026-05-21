"""Trace2 domain routes.

POST /trace2/batch-header — proxy to V1 (legacy-api, browser-verified).
POST /trace2/trace-graph  — native Databricks WITH RECURSIVE lineage graph.
"""
import asyncio
import dataclasses
import os
import httpx
from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, field_validator

from adapters.trace2.trace2_databricks_adapter import (
    Trace2BatchHeaderRequest,
    Trace2CustomerDeliveryRequest,
    Trace2CustomerExposureRequest,
    Trace2ProductionHistoryRequest,
    Trace2SupplierExposureRequest,
    TraceGraphRequest,
    get_batch_header_summary_spec,
    get_customer_delivery_spec,
    get_customer_exposure_spec,
    get_production_history_spec,
    get_supplier_exposure_spec,
    get_trace_graph_recursive_spec,
    map_batch_header_rows,
    map_customer_delivery_rows,
    map_customer_exposure_rows,
    map_production_history_rows,
    map_supplier_exposure_rows,
    map_trace_graph,
)
from contracts.generated import (
    CustomerExposureSummary,
    ProductionHistorySummary,
    SupplierExposureSummary,
    TraceGraph,
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
    plant_id: str = ""


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
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    if os.getenv("BACKEND_ADAPTER_MODE", "") == "databricks-api":
        host, warehouse_id = require_databricks_config()
        identity = build_user_identity(
            x_forwarded_access_token, x_forwarded_user, x_forwarded_email
        )
        request = Trace2BatchHeaderRequest(
            material_id=body.material_id,
            batch_id=body.batch_id,
            plant_id=body.plant_id,
        )
        rows, spec = await run_query(
            lambda: get_batch_header_summary_spec(request),
            identity, host, warehouse_id,
        )
        result = map_batch_header_rows(rows)
        if result is None:
            raise HTTPException(status_code=404, detail="Batch not found")
        set_databricks_response_headers(response, spec)
        return result
    return await _forward_post(
        "/api/t2/batch-header",
        body.model_dump(exclude_none=True),
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


@router.post("/trace2/trace-graph", response_model=TraceGraph)
async def trace_graph(
    body: TraceGraphBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
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
    max_depth = min(max(body.max_depth, 1), 5)
    max_edges = min(max(body.max_edges, 1), 5000)

    request = TraceGraphRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        plant_id=body.plant_id,
        direction=body.direction,
        max_depth=max_depth,
        max_edges=max_edges,
    )

    # direction="both" is split into two parallel single-direction queries.
    # Databricks stops WITH RECURSIVE early only when LIMIT is directly on the
    # recursive CTE reference (FROM ds LIMIT n). In a UNION ALL that placement
    # is a parse error, so a combined "both" query cannot carry per-arm LIMITs
    # and will hit the 1M intermediate-row system cap on dense graphs.
    #
    # Edge budget is split evenly (max_edges // 2 per direction) so that a
    # dense downstream result cannot starve upstream rows before the Python
    # truncation loop applies its max_edges cap on the combined set.
    if request.direction == "both":
        per_direction_edges = max(1, max_edges // 2)
        ds_req = dataclasses.replace(request, direction="downstream", max_edges=per_direction_edges)
        us_req = dataclasses.replace(request, direction="upstream", max_edges=per_direction_edges)
        (ds_rows, spec), (us_rows, _) = await asyncio.gather(
            run_query(lambda: get_trace_graph_recursive_spec(ds_req), identity, host, warehouse_id),
            run_query(lambda: get_trace_graph_recursive_spec(us_req), identity, host, warehouse_id),
        )
        rows = ds_rows + us_rows
    else:
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


# ---------------------------------------------------------------------------
# POST /trace2/customer-exposure — lineage-backed customer exposure first slice
# ---------------------------------------------------------------------------

class CustomerExposureBody(BaseModel):
    material_id: str
    batch_id: str
    plant_id: str = ""
    max_depth: int = 5
    max_rows: int = 5000


@router.post("/trace2/customer-exposure", response_model=CustomerExposureSummary)
async def customer_exposure(
    body: CustomerExposureBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/customer-exposure — lineage-only customer exposure first slice.

    Only available in databricks-api mode. No legacy-api fallback. No mock fallback.
    Source: gold_batch_lineage downstream WITH RECURSIVE, LINK_TYPE='DELIVERY' edges.

    Zero rows → HTTP 404. Zero rows must NOT be interpreted as zero exposure.
    Countries and blockedDeliveries are not populated in this slice (no gold_batch_delivery_v).
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="customer-exposure requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    max_depth = min(max(body.max_depth, 1), 10)
    max_rows = min(max(body.max_rows, 1), 10000)

    request = Trace2CustomerExposureRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        plant_id=body.plant_id,
        max_depth=max_depth,
        max_rows=max_rows,
    )

    rows, spec = await run_query(
        lambda: get_customer_exposure_spec(request),
        identity, host, warehouse_id,
    )
    result = map_customer_exposure_rows(rows)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No customer delivery records returned from current source — "
                "do not interpret as zero exposure until source coverage is validated."
            ),
        )
    set_databricks_response_headers(response, spec)
    return result


# ---------------------------------------------------------------------------
# POST /trace2/customer-deliveries — V1-parity delivery view slice
# ---------------------------------------------------------------------------

class CustomerDeliveryBody(BaseModel):
    material_id: str
    batch_id: str
    max_rows: int = 5000


@router.post("/trace2/customer-deliveries", response_model=CustomerExposureSummary)
async def customer_deliveries(
    body: CustomerDeliveryBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/customer-deliveries — V1-parity direct delivery records.

    Only available in databricks-api mode. No legacy-api fallback. No mock fallback.
    Source: gold_batch_delivery_v keyed on MATERIAL_ID + BATCH_ID (no plant filter).

    No plant filter: a recall must surface all plants a batch was shipped from.
    User confirmed 2026-05-20: "plant filtering is not relevant, a user needs to know
    wherever a material went to a customer regardless for the recall/trace to be effective."

    PENDING: MATERIAL_ID/BATCH_ID WHERE key column names need DESCRIBE TABLE confirmation.
    See customer-delivery-movement-type-validation.md §1.

    Zero rows → HTTP 404. Zero rows must NOT be interpreted as zero exposure.
    deliveryEvidenceSource = 'inventory-movements' in all successful responses.
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="customer-deliveries requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    max_rows = min(max(body.max_rows, 1), 10000)

    request = Trace2CustomerDeliveryRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        max_rows=max_rows,
    )

    rows, spec = await run_query(
        lambda: get_customer_delivery_spec(request),
        identity, host, warehouse_id,
    )
    result = map_customer_delivery_rows(rows)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No customer delivery records returned from current source — "
                "do not interpret as zero exposure until source coverage is validated."
            ),
        )
    set_databricks_response_headers(response, spec)
    return result


# ---------------------------------------------------------------------------
# POST /trace2/supplier-exposure — upstream VENDOR_RECEIPT supplier slice
# ---------------------------------------------------------------------------

class SupplierExposureBody(BaseModel):
    material_id: str
    batch_id: str
    max_rows: int = 1000


@router.post("/trace2/supplier-exposure", response_model=SupplierExposureSummary)
async def supplier_exposure(
    body: SupplierExposureBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/supplier-exposure — direct VENDOR_RECEIPT suppliers.

    Only available in databricks-api mode. No legacy-api fallback. No mock fallback.
    Source: gold_batch_lineage (LINK_TYPE='VENDOR_RECEIPT') joined to gold_supplier.
    Single-hop only (direct parents); multi-hop recursive walk is out of scope.

    Empty SUPPLIER_ID values are filtered at SQL — those represent unattributed
    inputs and are not real third-party suppliers.

    Zero suppliers → HTTP 200 with empty suppliers[] (not 404). A batch may
    legitimately have no purchased inputs (production-only batch). The panel
    surfaces zero-supplier state distinctly from an error.

    openSupplierActions and highestRiskSupplier are NOT populated by this slice
    — a verified QM source is required. See TRACE-P1-012.
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="supplier-exposure requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    max_rows = min(max(body.max_rows, 1), 5000)

    request = Trace2SupplierExposureRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        max_rows=max_rows,
    )

    rows, spec = await run_query(
        lambda: get_supplier_exposure_spec(request),
        identity, host, warehouse_id,
    )
    result = map_supplier_exposure_rows(rows)
    set_databricks_response_headers(response, spec)
    return result


# ---------------------------------------------------------------------------
# POST /trace2/production-history — recent batches for a material
# ---------------------------------------------------------------------------

class ProductionHistoryBody(BaseModel):
    material_id: str
    max_rows: int = 24


@router.post("/trace2/production-history", response_model=ProductionHistorySummary)
async def production_history(
    body: ProductionHistoryBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/production-history — recent production batches for a material.

    Only available in databricks-api mode. No legacy-api fallback. No mock fallback.
    Source: gold_batch_production_history_v keyed on MATERIAL_ID only (no plant
    filter — V1 showed batches across all plants to support isolated-vs-systemic
    assessment). Default 24 most-recent batches (V1 parity).

    Zero rows → HTTP 200 with totalBatches=0 and empty rows[]. A material may
    legitimately have no recent production history (e.g., raw-input material,
    not manufactured on-site). That state is informative, not an error.
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="production-history requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    max_rows = min(max(body.max_rows, 1), 200)

    request = Trace2ProductionHistoryRequest(
        material_id=body.material_id,
        max_rows=max_rows,
    )

    rows, spec = await run_query(
        lambda: get_production_history_spec(request),
        identity, host, warehouse_id,
    )
    result = map_production_history_rows(rows, body.material_id)
    set_databricks_response_headers(response, spec)
    return result
