"""Trace Investigation Databricks-api adapter — QuerySpec factories and row mapping.

Implemented slices:
  - get_batch_header_summary_spec / map_batch_header_rows
  - get_trace_graph_spec / map_trace_graph_rows  (depth=1 first pass)
  - get_mass_balance_spec / map_mass_balance_rows

Deferred slices:
  - getCustomerExposureSummary — requires severity/recall business rules not derivable
    from gold_batch_delivery_v; see docs/migration/databricks-vertical-slices-trace-plan.md §4

Route wiring deferred: existing proxy routes forward to V1. Wiring requires:
  1. Column names verified against live gold views in connected_plant_uat
  2. ADR-024 open questions #1 (Statement API vs Connector) and #7 (cache backend) resolved

IMPORTANT: All gold_batch_summary_v column names are unverified (marked TODO).
Column names for gold_batch_stock_v, gold_batch_lineage, gold_material, gold_plant,
gold_batch_mass_balance_v are confirmed from V1 source inspection (trace2-functional-parity-audit.md §3).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec


# ---------------------------------------------------------------------------
# Request dataclasses
# ---------------------------------------------------------------------------

@dataclass
class Trace2BatchHeaderRequest:
    material_id: str
    batch_id: str


@dataclass
class Trace2TraceGraphRequest:
    material_id: str
    batch_id: str


@dataclass
class Trace2MassBalanceRequest:
    material_id: str
    batch_id: str


# ---------------------------------------------------------------------------
# Slice 1 — getBatchHeaderSummary
# ---------------------------------------------------------------------------

def get_batch_header_summary_spec(request: Trace2BatchHeaderRequest) -> QuerySpec:
    """Return a QuerySpec for getBatchHeaderSummary.

    Sources: gold_batch_stock_v + gold_batch_summary_v + gold_material + gold_plant
    under TRACE_CATALOG / TRACE_SCHEMA (default: "gold").
    Contract: BatchHeaderSummarySchema (packages/data-contracts)
    Cache: PER_USER_60S — batch release/block status can change during a shift.
    Parallel validation: possible against browser-verified POST /api/trace2/batch-header.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl_stock = resolve_domain_object("trace2", "gold_batch_stock_v")
    tbl_summary = resolve_domain_object("trace2", "gold_batch_summary_v")
    tbl_material = resolve_domain_object("trace2", "gold_material")
    tbl_plant = resolve_domain_object("trace2", "gold_plant")

    sql = f"""
    SELECT
        s.material_id,                         -- confirmed column name (gold_batch_stock_v)
        s.batch_id,                            -- confirmed column name
        s.unrestricted,                        -- confirmed column name
        s.blocked,                             -- confirmed column name
        s.quality_inspection,                  -- confirmed column name
        s.restricted,                          -- confirmed column name
        s.transit,                             -- confirmed column name
        s.total_stock,                         -- confirmed column name
        m.material_name,                       -- confirmed column name (gold_material)
        p.plant_name,                          -- confirmed column name (gold_plant)
        b.plant_id         AS plant_id,        -- TODO: verify column name in gold_batch_summary_v
        b.manufacture_date AS manufacture_date, -- TODO: verify column name in gold_batch_summary_v
        b.expiry_date      AS expiry_date,     -- TODO: verify column name in gold_batch_summary_v
        b.batch_status     AS batch_status,    -- TODO: verify column name in gold_batch_summary_v
        b.uom              AS uom,             -- TODO: verify column name in gold_batch_summary_v
        b.process_order_id AS process_order_id -- TODO: verify column name in gold_batch_summary_v
    FROM {tbl_stock} s
    JOIN {tbl_summary} b                       -- TODO: verify join key columns
        ON s.material_id = b.material_id AND s.batch_id = b.batch_id
    JOIN {tbl_material} m                      -- confirmed join key
        ON s.material_id = m.material_id AND m.language_id = 'EN'  -- TODO: verify language_id filter
    JOIN {tbl_plant} p                         -- confirmed join key
        ON b.plant_id = p.plant_id             -- TODO: verify plant_id column in gold_batch_summary_v
    WHERE s.material_id = :material_id
      AND s.batch_id = :batch_id
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_batch_header_summary",
        module="trace2",
        endpoint="/api/trace2/batch-header",
        sql=sql,
        params={"material_id": request.material_id, "batch_id": request.batch_id},
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_summary_v",
        tags=["trace2", "batch-header", "summary"],
    )


def map_batch_header_rows(rows: list[dict]) -> Optional[dict]:
    """Map Databricks rows to BatchHeaderSummarySchema shape.

    Returns None if no rows (caller should return HTTP 404).
    """
    if not rows:
        return None
    row = rows[0]

    result: dict = {
        "materialId": row["material_id"],
        "materialDescription": row.get("material_name") or "",
        "batchId": row["batch_id"],
        "plantId": row.get("plant_id") or "",
        "plantName": row.get("plant_name") or "",
        "batchStatus": _map_batch_status(row.get("batch_status")),
        "stockStatus": _derive_stock_status(row),
        "qualityStatus": _derive_quality_status(row),
        "releaseStatus": _derive_release_status(row.get("batch_status")),
    }

    if row.get("total_stock") is not None:
        result["quantity"] = float(row["total_stock"])
    if row.get("uom"):
        result["uom"] = row["uom"]
    if row.get("manufacture_date"):
        result["manufactureDate"] = row["manufacture_date"]
    if row.get("expiry_date"):
        result["expiryDate"] = row["expiry_date"]
    if row.get("process_order_id"):
        result["processOrderId"] = row["process_order_id"]

    return result


# ---------------------------------------------------------------------------
# Slice 2 — getTraceGraph (depth=1)
# ---------------------------------------------------------------------------

def get_trace_graph_spec(request: Trace2TraceGraphRequest) -> QuerySpec:
    """Return a QuerySpec for getTraceGraph at depth=1.

    Source: gold_batch_lineage + gold_material + gold_plant
    under TRACE_CATALOG / TRACE_SCHEMA (default: "gold").
    Contract: TraceGraphSchema (packages/data-contracts)
    Cache: PER_USER_60S — lineage data can shift as movements are posted.
    Depth: 1 only — flat SELECT of direct parents/children.
    Recursion deferred until column names confirmed and ADR-024 resolved.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl_lineage = resolve_domain_object("trace2", "gold_batch_lineage")
    tbl_material = resolve_domain_object("trace2", "gold_material")
    tbl_plant = resolve_domain_object("trace2", "gold_plant")

    sql = f"""
    SELECT
        l.parent_material_id,                               -- confirmed column name
        l.parent_batch_id,                                  -- confirmed column name
        l.parent_plant_id,                                  -- confirmed column name
        l.child_material_id,                                -- confirmed column name
        l.child_batch_id,                                   -- confirmed column name
        l.child_plant_id,                                   -- confirmed column name
        l.link_type,                                        -- confirmed column name
        pm.material_name AS parent_material_name,           -- TODO: verify join; language_id filter needed
        cm.material_name AS child_material_name,            -- TODO: verify join; language_id filter needed
        pp.plant_name    AS parent_plant_name,              -- TODO: verify join key
        cp.plant_name    AS child_plant_name                -- TODO: verify join key
    FROM {tbl_lineage} l
    LEFT JOIN {tbl_material} pm                             -- TODO: verify language_id column/value
        ON l.parent_material_id = pm.material_id AND pm.language_id = 'EN'
    LEFT JOIN {tbl_material} cm                             -- TODO: verify language_id column/value
        ON l.child_material_id = cm.material_id AND cm.language_id = 'EN'
    LEFT JOIN {tbl_plant} pp ON l.parent_plant_id = pp.plant_id  -- TODO: verify plant_id column
    LEFT JOIN {tbl_plant} cp ON l.child_plant_id = cp.plant_id   -- TODO: verify plant_id column
    WHERE (l.parent_batch_id = :batch_id AND l.parent_material_id = :material_id)
       OR (l.child_batch_id = :batch_id AND l.child_material_id = :material_id)
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_trace_graph",
        module="trace2",
        endpoint="/api/trace2/trace-graph",
        sql=sql,
        params={"material_id": request.material_id, "batch_id": request.batch_id},
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_lineage",
        max_rows=500,
        tags=["trace2", "trace-graph", "lineage"],
    )


def map_trace_graph_rows(rows: list[dict], root_batch: str) -> dict:
    """Map Databricks lineage rows to TraceGraphSchema shape.

    Depth=1: all direct parents/children of root_batch.
    Nodes keyed by (material_id, batch_id) — duplicates suppressed.
    Edges keyed by (source_id, target_id, relationship_type) — duplicates suppressed.
    Node type defaults to 'intermediate' — gold_batch_lineage has no material-type column.
    """
    if not rows:
        return {
            "nodes": [],
            "edges": [],
            "direction": "both",
            "depth": 1,
            "rootBatch": root_batch,
            "upstreamCount": 0,
            "downstreamCount": 0,
            "unresolvedNodeCount": 0,
        }

    nodes: dict[str, dict] = {}
    edges: dict[str, dict] = {}
    upstream_batches: set[str] = set()
    downstream_batches: set[str] = set()

    for row in rows:
        parent_id = f"{row['parent_material_id']}:{row['parent_batch_id']}"
        child_id = f"{row['child_material_id']}:{row['child_batch_id']}"

        if parent_id not in nodes:
            nodes[parent_id] = {
                "id": parent_id,
                "type": "intermediate",
                "materialId": row["parent_material_id"],
                "materialDescription": row.get("parent_material_name") or "",
                "batchId": row["parent_batch_id"],
                "plantId": row.get("parent_plant_id"),
            }

        if child_id not in nodes:
            nodes[child_id] = {
                "id": child_id,
                "type": "intermediate",
                "materialId": row["child_material_id"],
                "materialDescription": row.get("child_material_name") or "",
                "batchId": row["child_batch_id"],
                "plantId": row.get("child_plant_id"),
            }

        relationship = _map_link_type(row.get("link_type"))
        edge_key = f"{parent_id}|{child_id}|{relationship}"
        if edge_key not in edges:
            edges[edge_key] = {
                "id": edge_key,
                "source": parent_id,
                "target": child_id,
                "relationshipType": relationship,
            }

        if row["child_batch_id"] == root_batch:
            upstream_batches.add(parent_id)
        if row["parent_batch_id"] == root_batch:
            downstream_batches.add(child_id)

    return {
        "nodes": list(nodes.values()),
        "edges": list(edges.values()),
        "direction": "both",
        "depth": 1,
        "rootBatch": root_batch,
        "upstreamCount": len(upstream_batches),
        "downstreamCount": len(downstream_batches),
        "unresolvedNodeCount": 0,
    }


# ---------------------------------------------------------------------------
# Slice 3 — getMassBalanceSummary
# ---------------------------------------------------------------------------

def get_mass_balance_spec(request: Trace2MassBalanceRequest) -> QuerySpec:
    """Return a QuerySpec for getMassBalanceSummary.

    Source: gold_batch_mass_balance_v under TRACE_CATALOG / TRACE_SCHEMA (default: "gold").
    Contract: MassBalanceSummarySchema + MassBalanceMovementSchema (packages/data-contracts)
    Cache: PER_USER_60S — movement postings occur throughout the shift.
    balance_qty is the confirmed running-balance column — maps directly to runningBalance.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl_mass_balance = resolve_domain_object("trace2", "gold_batch_mass_balance_v")

    sql = f"""
    SELECT
        posting_date,      -- confirmed column name
        movement_type,     -- confirmed column name
        movement_category, -- confirmed column name
        abs_quantity,      -- confirmed column name
        uom,               -- confirmed column name
        balance_qty        -- confirmed — running balance; maps directly to runningBalance
    FROM {tbl_mass_balance}
    WHERE material_id = :material_id  -- TODO: verify filter column name
      AND batch_id = :batch_id         -- TODO: verify filter column name
    ORDER BY posting_date
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_mass_balance",
        module="trace2",
        endpoint="/api/trace2/mass-balance",
        sql=sql,
        params={"material_id": request.material_id, "batch_id": request.batch_id},
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_mass_balance_v",
        tags=["trace2", "mass-balance"],
    )


def map_mass_balance_rows(rows: list[dict]) -> dict:
    """Map Databricks mass balance rows to MassBalanceSummarySchema shape.

    Totals:
      inputQuantity  = sum abs_quantity where category = 'production'
      outputQuantity = sum abs_quantity where category in ('shipment', 'consumption')
      varianceQuantity = input - output
      variancePercent  = variance/input*100 if input > 0 else 0.0

    balance_qty maps directly to runningBalance (confirmed running-balance column).
    Rows with null balance_qty increment unresolvedMovements; runningBalance defaults to 0.0.
    """
    if not rows:
        return {
            "inputQuantity": 0.0,
            "outputQuantity": 0.0,
            "varianceQuantity": 0.0,
            "variancePercent": 0.0,
            "uom": "",
            "confidence": 1.0,
            "unresolvedMovements": 0,
            "movements": [],
        }

    input_qty = 0.0
    output_qty = 0.0
    unresolved = 0
    movements: list[dict] = []

    for row in rows:
        category = _map_movement_category(row.get("movement_category"))
        abs_qty = float(row.get("abs_quantity") or 0)

        if category == "production":
            input_qty += abs_qty
            delta = abs_qty
        else:
            output_qty += abs_qty
            delta = -abs_qty

        balance_qty = row.get("balance_qty")
        if balance_qty is None:
            unresolved += 1

        movements.append({
            "date": row.get("posting_date"),
            "category": category,
            "quantity": abs_qty,
            "delta": delta,
            "runningBalance": float(balance_qty) if balance_qty is not None else 0.0,
            "uom": row.get("uom") or "",
            "movementType": row.get("movement_type"),
        })

    variance_qty = input_qty - output_qty
    variance_pct = (variance_qty / input_qty * 100) if input_qty > 0 else 0.0
    uom = rows[0].get("uom") or "" if rows else ""

    return {
        "inputQuantity": input_qty,
        "outputQuantity": output_qty,
        "varianceQuantity": variance_qty,
        "variancePercent": variance_pct,
        "uom": uom,
        "confidence": 1.0,
        "unresolvedMovements": unresolved,
        "movements": movements,
    }


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

_LINK_TYPE_MAP: dict[str, str] = {
    "PRODUCTION": "produced-from",
    "BATCH_TRANSFER": "transferred-to",
    "STO_TRANSFER": "transferred-to",
    "VENDOR_RECEIPT": "component-of",
    "CONSUMPTION": "component-of",
    "DELIVERY": "delivered-to",
    "SPLIT": "split-from",
    "MERGE": "merged-into",
}

_MOVEMENT_CATEGORY_MAP: dict[str, str] = {
    "PRODUCTION": "production",
    "SHIPMENT": "shipment",
    "CONSUMPTION": "consumption",
    "ADJUSTMENT": "adjustment",
}

_BATCH_STATUS_MAP: dict[str, str] = {
    "BLOCKED": "blocked",
    "B": "blocked",
    "2": "blocked",
    "ARCHIVED": "archived",
    "A": "archived",
    "ACTIVE": "active",
    "RELEASED": "active",
    "R": "active",
    "1": "active",
    "DELETED": "deleted",
    "D": "deleted",
    "4": "deleted",
}

_RELEASE_STATUS_MAP: dict[str, str] = {
    "RELEASED": "released",
    "R": "released",
    "1": "released",
    "ACTIVE": "released",
    "BLOCKED": "blocked",
    "B": "blocked",
    "2": "blocked",
    "RESTRICTED": "restricted",
    "NOT_RELEASED": "not-released",
    "NOT-RELEASED": "not-released",
    "N": "not-released",
    "0": "not-released",
}


def _map_link_type(raw: Optional[str]) -> str:
    return _LINK_TYPE_MAP.get((raw or "").upper().strip(), "component-of")


def _map_movement_category(raw: Optional[str]) -> str:
    return _MOVEMENT_CATEGORY_MAP.get((raw or "").upper().strip(), "adjustment")


def _map_batch_status(raw: Optional[str]) -> str:
    if raw is None:
        return "active"
    return _BATCH_STATUS_MAP.get(str(raw).upper().strip(), "active")


def _derive_stock_status(row: dict) -> str:
    def qty(col: str) -> float:
        return float(row.get(col) or 0)

    if qty("blocked") > 0:
        return "blocked"
    if qty("quality_inspection") > 0:
        return "quality-inspection"
    if qty("restricted") > 0:
        return "returns"
    if qty("transit") > 0:
        return "transit"
    return "unrestricted"


def _derive_quality_status(row: dict) -> str:
    if float(row.get("quality_inspection") or 0) > 0:
        return "pending"
    return "not-applicable"


def _derive_release_status(raw: Optional[str]) -> str:
    if raw is None:
        return "unknown"
    return _RELEASE_STATUS_MAP.get(str(raw).upper().strip(), "unknown")
