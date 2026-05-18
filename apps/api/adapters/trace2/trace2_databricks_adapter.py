"""Trace Investigation Databricks-api adapter — QuerySpec factories and row mapping.

Implemented slices:
  - get_batch_header_summary_spec / map_batch_header_rows
  - get_trace_graph_anchor_spec + get_trace_graph_hop_spec / map_trace_graph
  - get_mass_balance_spec / map_mass_balance_rows

Deferred slices:
  - getCustomerExposureSummary — requires severity/recall business rules not derivable
    from gold_batch_delivery_v; see docs/migration/databricks-vertical-slices-trace-plan.md §4

IMPORTANT: All gold_batch_summary_v column names are unverified (marked TODO).
Column names for gold_batch_stock_v, gold_batch_lineage, gold_material, gold_plant,
gold_batch_mass_balance_v are confirmed from V1 source inspection (trace2-functional-parity-audit.md §3).

Trace graph uses iterative multi-hop expansion (not recursive CTE) — WITH RECURSIVE support
under the Databricks Statement API cannot be verified against UAT without DDL execution.
The route orchestrates one QuerySpec call per depth hop in a Python loop.
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
class TraceGraphRequest:
    material_id: str
    batch_id: str
    plant_id: str
    direction: str = "both"   # "upstream" | "downstream" | "both"
    max_depth: int = 6
    max_edges: int = 1000


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
# Slice 2 — getTraceGraph (iterative multi-hop expansion)
# ---------------------------------------------------------------------------

# All 18 confirmed DDL columns from gold_batch_lineage, aliased lowercase so
# Databricks Statement API returns consistent lowercase dict keys.
_TRACE_GRAPH_SELECT = """\
    SELECT
        PARENT_MATERIAL_ID        AS parent_material_id,
        PARENT_BATCH_ID           AS parent_batch_id,
        PARENT_PLANT_ID           AS parent_plant_id,
        CHILD_MATERIAL_ID         AS child_material_id,
        CHILD_BATCH_ID            AS child_batch_id,
        CHILD_PLANT_ID            AS child_plant_id,
        LINK_TYPE                 AS link_type,
        PROCESS_ORDER_ID          AS process_order_id,
        MATERIAL_DOCUMENT_NUMBER  AS material_document_number,
        PURCHASE_ORDER_ID         AS purchase_order_id,
        SUPPLIER_ID               AS supplier_id,
        CUSTOMER_ID               AS customer_id,
        DELIVERY_ID               AS delivery_id,
        SALES_ORDER_ID            AS sales_order_id,
        QUANTITY                  AS quantity,
        BASE_UNIT_OF_MEASURE      AS base_unit_of_measure,
        POSTING_DATE              AS posting_date,
        MOVEMENT_TYPE             AS movement_type"""


def get_trace_graph_anchor_spec(request: TraceGraphRequest) -> QuerySpec:
    """QuerySpec for hop 0 — edges directly touching the anchor node.

    Anchor (material_id, batch_id, plant_id) is bound as named params — user input.
    Direction controls which side of the edge the anchor must appear on:
      downstream → anchor must be PARENT (anchor produced something)
      upstream   → anchor must be CHILD  (something produced anchor)
      both       → either side
    """
    tbl = resolve_domain_object("trace2", "gold_batch_lineage")

    if request.direction == "downstream":
        where = (
            "PARENT_MATERIAL_ID = :material_id"
            " AND PARENT_BATCH_ID = :batch_id"
            " AND PARENT_PLANT_ID = :plant_id"
        )
    elif request.direction == "upstream":
        where = (
            "CHILD_MATERIAL_ID = :material_id"
            " AND CHILD_BATCH_ID = :batch_id"
            " AND CHILD_PLANT_ID = :plant_id"
        )
    else:  # both
        where = (
            "(PARENT_MATERIAL_ID = :material_id"
            " AND PARENT_BATCH_ID = :batch_id"
            " AND PARENT_PLANT_ID = :plant_id)"
            "\n       OR (CHILD_MATERIAL_ID = :material_id"
            " AND CHILD_BATCH_ID = :batch_id"
            " AND CHILD_PLANT_ID = :plant_id)"
        )

    sql = f"""
{_TRACE_GRAPH_SELECT}
    FROM {tbl}
    WHERE {where}
    """

    return QuerySpec(
        name="trace2.get_trace_graph",
        module="trace2",
        endpoint="/api/trace2/trace-graph",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_lineage",
        tags=["trace2", "trace-graph", "lineage"],
    )


def get_trace_graph_hop_spec(
    frontier: list[tuple[str, str, str]],
    direction: str,
) -> QuerySpec:
    """QuerySpec for hops 1..N in iterative traversal.

    frontier: server-generated (material_id, batch_id, plant_id) tuples produced
    by the previous hop — safe to embed as SQL tuple literals.
    No user input reaches this SQL; anchor params are only in the hop-0 spec.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_lineage")

    tuple_list = ", ".join(
        f"({_sql_str(m)}, {_sql_str(b)}, {_sql_str(p)})"
        for m, b, p in frontier
    )

    if direction == "downstream":
        where = (
            f"(PARENT_MATERIAL_ID, PARENT_BATCH_ID, PARENT_PLANT_ID)"
            f" IN ({tuple_list})"
        )
    elif direction == "upstream":
        where = (
            f"(CHILD_MATERIAL_ID, CHILD_BATCH_ID, CHILD_PLANT_ID)"
            f" IN ({tuple_list})"
        )
    else:  # both
        where = (
            f"(PARENT_MATERIAL_ID, PARENT_BATCH_ID, PARENT_PLANT_ID) IN ({tuple_list})"
            f"\n       OR (CHILD_MATERIAL_ID, CHILD_BATCH_ID, CHILD_PLANT_ID) IN ({tuple_list})"
        )

    sql = f"""
{_TRACE_GRAPH_SELECT}
    FROM {tbl}
    WHERE {where}
    """

    return QuerySpec(
        name="trace2.get_trace_graph",
        module="trace2",
        endpoint="/api/trace2/trace-graph",
        sql=sql,
        params={},  # frontier values are server-generated and embedded as literals
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_lineage",
        tags=["trace2", "trace-graph", "lineage"],
    )


def map_trace_graph(
    tagged_rows: list[tuple[dict, int, str]],
    request: TraceGraphRequest,
    depth_reached: int,
    truncated: bool,
) -> dict:
    """Map iterative traversal results to the q.txt trace graph response shape.

    tagged_rows: list of (row_dict, hop_index, direction_str) produced by the route loop.
    Anchor node is always included even when tagged_rows is empty.
    Nodes and edges are deduped by key; leading zeros preserved (no numeric casting).
    """
    anchor_key = _node_key(request.material_id, request.batch_id, request.plant_id)

    nodes: dict[str, dict] = {
        anchor_key: {
            "nodeKey": anchor_key,
            "materialId": request.material_id,
            "batchId": request.batch_id,
            "plantId": request.plant_id,
            "label": f"{request.material_id} / {request.batch_id}",
            "depth": 0,
            "directions": ["anchor"],
            "isAnchor": True,
        }
    }
    edges: dict[str, dict] = {}
    warnings: list[str] = []

    for row, hop, direction in tagged_rows:
        parent_key = _node_key(
            row["parent_material_id"],
            row["parent_batch_id"],
            row["parent_plant_id"],
        )
        child_key = _node_key(
            row["child_material_id"],
            row["child_batch_id"],
            row["child_plant_id"],
        )

        # Assign depth: for downstream the parent was found at hop, child is one step further.
        # For upstream the child was found at hop, parent is one step further.
        if direction == "downstream":
            parent_depth, child_depth = hop, hop + 1
        else:
            parent_depth, child_depth = hop + 1, hop

        if parent_key not in nodes:
            nodes[parent_key] = _make_graph_node(
                row, "parent", parent_depth, direction
            )
        elif direction not in nodes[parent_key]["directions"]:
            nodes[parent_key]["directions"].append(direction)

        if child_key not in nodes:
            nodes[child_key] = _make_graph_node(
                row, "child", child_depth, direction
            )
        elif direction not in nodes[child_key]["directions"]:
            nodes[child_key]["directions"].append(direction)

        link_type = row.get("link_type") or ""
        doc_num = row.get("material_document_number") or ""
        edge_key = f"{parent_key}|{child_key}|{link_type}|{doc_num}|{hop}"
        if edge_key not in edges:
            edges[edge_key] = _make_graph_edge(
                row, parent_key, child_key, edge_key, hop, direction
            )

    if not tagged_rows:
        warnings.append("no_edges_found")
    if truncated:
        warnings.append("max_edges_reached")
    if depth_reached >= request.max_depth and tagged_rows:
        warnings.append("max_depth_reached")

    return {
        "anchor": {
            "materialId": request.material_id,
            "batchId": request.batch_id,
            "plantId": request.plant_id,
            "nodeKey": anchor_key,
        },
        "nodes": list(nodes.values()),
        "edges": list(edges.values()),
        "depthReached": depth_reached,
        "truncated": truncated,
        "warnings": warnings,
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

def _node_key(material_id: str, batch_id: str, plant_id: str) -> str:
    """Unique key for a batch node — includes plant_id to prevent collisions."""
    return f"{material_id}:{batch_id}:{plant_id}"


def _sql_str(value: str | None) -> str:
    """Embed a server-generated string as a SQL single-quoted literal.

    Only call with values produced by a prior Databricks query result, never with
    raw user input. Single-quotes within the value are escaped by doubling.
    None guard: the route filters NULL-key rows before building the frontier,
    but if one slips through, NULL in the IN clause matches nothing rather than crashing.
    """
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def _make_graph_node(row: dict, side: str, depth: int, direction: str) -> dict:
    prefix = "parent" if side == "parent" else "child"
    mat = row[f"{prefix}_material_id"]
    bat = row[f"{prefix}_batch_id"]
    pla = row[f"{prefix}_plant_id"]
    return {
        "nodeKey": _node_key(mat, bat, pla),
        "materialId": mat,
        "batchId": bat,
        "plantId": pla,
        "label": f"{mat} / {bat}",
        "depth": depth,
        "directions": [direction],
        "isAnchor": False,
    }


def _make_graph_edge(
    row: dict,
    parent_key: str,
    child_key: str,
    edge_id: str,
    depth: int,
    direction: str,
) -> dict:
    qty_raw = row.get("quantity")
    return {
        "id": edge_id,
        "source": parent_key,
        "target": child_key,
        "linkType": row.get("link_type"),
        "processOrderId": row.get("process_order_id"),
        "materialDocumentNumber": row.get("material_document_number"),
        "purchaseOrderId": row.get("purchase_order_id"),
        "supplierId": row.get("supplier_id"),
        "customerId": row.get("customer_id"),
        "deliveryId": row.get("delivery_id"),
        "salesOrderId": row.get("sales_order_id"),
        "quantity": float(qty_raw) if qty_raw is not None else None,
        "baseUnitOfMeasure": row.get("base_unit_of_measure"),
        "postingDate": row.get("posting_date"),
        "movementType": row.get("movement_type"),
        "depth": depth,
        "direction": direction,
    }


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
