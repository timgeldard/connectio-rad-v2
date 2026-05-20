"""Trace Investigation Databricks-api adapter — QuerySpec factories and row mapping.

Implemented slices:
  - get_batch_header_summary_spec / map_batch_header_rows
  - get_trace_graph_recursive_spec / map_trace_graph
  - get_mass_balance_spec / map_mass_balance_rows
  - get_customer_exposure_spec / map_customer_exposure_rows  (lineage-only first slice)
  - get_customer_delivery_spec / map_customer_delivery_rows  (gold_batch_delivery_v, V1-parity)

Pending verification (Scope E):
  - WHERE keys MATERIAL_ID/BATCH_ID in gold_batch_delivery_v need DESCRIBE TABLE confirmation.
    Column names are consistent with all other gold views but must be validated in UAT before
    promoting to production. See customer-delivery-movement-type-validation.md §Validation SQL.

Column name verification status (live validation 2026-05-19, connected_plant_uat):
  - gold_batch_summary_v: MANUFACTURE_DATE and SHELF_LIFE_EXPIRATION_DATE verified. PLANT_ID,
    BATCH_STATUS, UOM, PROCESS_ORDER_ID are NOT present in this view. plant_id sourced from
    gold_batch_stock_v; uom from gold_material.BASE_UNIT_OF_MEASURE.
  - gold_batch_stock_v: column names confirmed from V1 inspection (see trace2-functional-parity-audit.md §3).
    PLANT_ID also confirmed live.
  - gold_material: LANGUAGE_ID = 'E' (not 'EN'), MATERIAL_NAME, BASE_UNIT_OF_MEASURE verified live.
  - gold_plant: PLANT_ID, PLANT_NAME confirmed from V1 inspection.
  - gold_batch_lineage: all 18 columns confirmed — see trace2-functional-parity-audit.md §3.
  - gold_batch_mass_balance_v: SELECT columns confirmed; WHERE filter column names unverified (TODO).

Trace graph uses a single WITH RECURSIVE SQL query (server-side traversal). Queries the base
table directly in each recursive arm (no preceding ue dedup CTE) so Databricks can use
file-skipping on the clustered (CHILD_MATERIAL_ID, CHILD_BATCH_ID) columns per hop.
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
    plant_id: str = ""   # optional — filters to a single plant when provided


@dataclass
class TraceGraphRequest:
    material_id: str
    batch_id: str
    plant_id: str = ""        # optional — stored on nodes for display, not used in SQL filter
    direction: str = "both"   # "upstream" | "downstream" | "both"
    max_depth: int = 3
    max_edges: int = 1000


@dataclass
class Trace2MassBalanceRequest:
    material_id: str
    batch_id: str


@dataclass
class Trace2CustomerExposureRequest:
    material_id: str
    batch_id: str
    plant_id: str = ""
    max_depth: int = 5
    max_rows: int = 5000


@dataclass
class Trace2CustomerDeliveryRequest:
    material_id: str
    batch_id: str
    max_rows: int = 5000   # no plant_id — user confirmed: all plants needed for recall coverage


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

    Multi-plant note: gold_batch_stock_v returns one row per plant per batch. When
    plant_id is provided the SQL filters to that plant, removing cross-plant ambiguity.
    When plant_id is absent the query returns all plants ordered by PLANT_ID; the mapper
    takes the first row. UAT inputs normally include plant_id so multi-plant ambiguity
    is resolved in the standard flow.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl_stock = resolve_domain_object("trace2", "gold_batch_stock_v")
    tbl_summary = resolve_domain_object("trace2", "gold_batch_summary_v")
    tbl_material = resolve_domain_object("trace2", "gold_material")
    tbl_plant = resolve_domain_object("trace2", "gold_plant")

    sql = f"""
    SELECT
        s.MATERIAL_ID                AS material_id,             -- confirmed: gold_batch_stock_v
        s.BATCH_ID                   AS batch_id,                -- confirmed: gold_batch_stock_v
        s.unrestricted,                                          -- confirmed: gold_batch_stock_v (V1 inspection)
        s.blocked,                                              -- confirmed: gold_batch_stock_v
        s.quality_inspection,                                   -- confirmed: gold_batch_stock_v
        s.restricted,                                           -- confirmed: gold_batch_stock_v
        s.transit,                                              -- confirmed: gold_batch_stock_v
        s.total_stock,                                          -- confirmed: gold_batch_stock_v
        s.PLANT_ID                   AS plant_id,               -- verified: 2026-05-19 connected_plant_uat (not in gold_batch_summary_v)
        m.MATERIAL_NAME              AS material_name,          -- verified: 2026-05-19 connected_plant_uat
        m.BASE_UNIT_OF_MEASURE       AS uom,                    -- verified: 2026-05-19 connected_plant_uat (not in gold_batch_summary_v)
        p.PLANT_NAME                 AS plant_name,             -- confirmed: gold_plant (V1 inspection)
        b.MANUFACTURE_DATE           AS manufacture_date,       -- verified: 2026-05-19 connected_plant_uat
        b.SHELF_LIFE_EXPIRATION_DATE AS expiry_date             -- verified: 2026-05-19 connected_plant_uat
    FROM {tbl_stock} s
    JOIN {tbl_summary} b                                        -- verified join key: MATERIAL_ID + BATCH_ID
        ON s.MATERIAL_ID = b.MATERIAL_ID AND s.BATCH_ID = b.BATCH_ID
    JOIN {tbl_material} m                                       -- confirmed join key
        ON s.MATERIAL_ID = m.MATERIAL_ID AND m.LANGUAGE_ID = 'E'  -- verified: 2026-05-19 connected_plant_uat
    JOIN {tbl_plant} p                                          -- confirmed join key
        ON s.PLANT_ID = p.PLANT_ID                              -- verified: 2026-05-19 connected_plant_uat
    WHERE s.MATERIAL_ID = :material_id
      AND s.BATCH_ID = :batch_id
      AND (:plant_id = '' OR s.PLANT_ID = :plant_id)
    ORDER BY s.PLANT_ID
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_batch_header_summary",
        module="trace2",
        endpoint="/api/trace2/batch-header",
        sql=sql,
        params={"material_id": request.material_id, "batch_id": request.batch_id, "plant_id": request.plant_id},
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
    if row.get("unrestricted") is not None:
        result["unrestricted"] = float(row["unrestricted"])
    if row.get("blocked") is not None:
        result["blocked"] = float(row["blocked"])
    if row.get("quality_inspection") is not None:
        result["qualityInspection"] = float(row["quality_inspection"])
    if row.get("restricted") is not None:
        result["restricted"] = float(row["restricted"])
    if row.get("transit") is not None:
        result["transit"] = float(row["transit"])
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
# Slice 2 — getTraceGraph (single WITH RECURSIVE query)
# ---------------------------------------------------------------------------

def get_trace_graph_recursive_spec(request: TraceGraphRequest) -> QuerySpec:
    """QuerySpec for trace graph — single WITH RECURSIVE server-side traversal.

    Anchor matched on material_id + batch_id only (no plant_id filter).
    Returns hop_depth (1-based) and traversal_dir per edge row; the route converts
    hop_depth to 0-based when building tagged_rows for map_trace_graph.

    Cycle detection: path column tracks visited 2-tuple keys (material_id:batch_id).
    Recursive join uses plant_id for correct edge resolution; cycle guard uses 2-tuple.

    gold_material is LEFT JOINed on the outer SELECT only (not inside the recursive CTE)
    to populate parent_material_name / child_material_name on every edge row.

    No ue dedup CTE: gold_batch_lineage is clustered on (CHILD_MATERIAL_ID, CHILD_BATCH_ID).
    Querying the table directly lets Databricks skip 99% of files per hop. A preceding
    SELECT DISTINCT over the full table caused cold-run 504s on a 479M-row table.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_lineage")
    tbl_material = resolve_domain_object("trace2", "gold_material")

    # gold_batch_lineage is clustered on (CHILD_MATERIAL_ID, CHILD_BATCH_ID).
    # Referencing the table directly in each recursive arm lets Databricks use
    # file-skipping per hop. A preceding ue CTE (SELECT DISTINCT over the full
    # table) materialised 479M rows before any recursion, causing a cold-run
    # full table scan that reliably exceeded the 30s gateway timeout.
    _null_guard = (
        "PARENT_MATERIAL_ID IS NOT NULL AND PARENT_BATCH_ID IS NOT NULL"
        " AND CHILD_MATERIAL_ID IS NOT NULL AND CHILD_BATCH_ID IS NOT NULL"
    )

    # Downstream CTE: anchor is PARENT, recurse following CHILD edges forward
    ds_cte = f"""\
  ds AS (
    SELECT
      1 AS hop_depth, 'downstream' AS traversal_dir,
      PARENT_MATERIAL_ID, PARENT_BATCH_ID, PARENT_PLANT_ID,
      CHILD_MATERIAL_ID, CHILD_BATCH_ID, CHILD_PLANT_ID,
      LINK_TYPE, PROCESS_ORDER_ID, MATERIAL_DOCUMENT_NUMBER,
      PURCHASE_ORDER_ID, SUPPLIER_ID, CUSTOMER_ID, DELIVERY_ID,
      SALES_ORDER_ID, QUANTITY, BASE_UNIT_OF_MEASURE, POSTING_DATE, MOVEMENT_TYPE,
      CONCAT('|', :material_id, ':', :batch_id, '|',
             CHILD_MATERIAL_ID, ':', CHILD_BATCH_ID, '|') AS path
    FROM {tbl}
    WHERE PARENT_MATERIAL_ID = :material_id AND PARENT_BATCH_ID = :batch_id
      AND {_null_guard}
    UNION ALL
    SELECT
      t.hop_depth + 1, 'downstream',
      e.PARENT_MATERIAL_ID, e.PARENT_BATCH_ID, e.PARENT_PLANT_ID,
      e.CHILD_MATERIAL_ID, e.CHILD_BATCH_ID, e.CHILD_PLANT_ID,
      e.LINK_TYPE, e.PROCESS_ORDER_ID, e.MATERIAL_DOCUMENT_NUMBER,
      e.PURCHASE_ORDER_ID, e.SUPPLIER_ID, e.CUSTOMER_ID, e.DELIVERY_ID,
      e.SALES_ORDER_ID, e.QUANTITY, e.BASE_UNIT_OF_MEASURE, e.POSTING_DATE, e.MOVEMENT_TYPE,
      CONCAT(t.path, e.CHILD_MATERIAL_ID, ':', e.CHILD_BATCH_ID, '|')
    FROM {tbl} e
    JOIN ds t
      ON e.PARENT_MATERIAL_ID = t.CHILD_MATERIAL_ID
      AND e.PARENT_BATCH_ID = t.CHILD_BATCH_ID
      AND e.PARENT_PLANT_ID <=> t.CHILD_PLANT_ID
    WHERE t.hop_depth < :max_depth
      AND e.CHILD_MATERIAL_ID IS NOT NULL AND e.CHILD_BATCH_ID IS NOT NULL
      AND INSTR(t.path, CONCAT('|', e.CHILD_MATERIAL_ID, ':', e.CHILD_BATCH_ID, '|')) = 0
  )"""

    # Upstream CTE: anchor is CHILD, recurse following PARENT edges backward
    us_cte = f"""\
  us AS (
    SELECT
      1 AS hop_depth, 'upstream' AS traversal_dir,
      PARENT_MATERIAL_ID, PARENT_BATCH_ID, PARENT_PLANT_ID,
      CHILD_MATERIAL_ID, CHILD_BATCH_ID, CHILD_PLANT_ID,
      LINK_TYPE, PROCESS_ORDER_ID, MATERIAL_DOCUMENT_NUMBER,
      PURCHASE_ORDER_ID, SUPPLIER_ID, CUSTOMER_ID, DELIVERY_ID,
      SALES_ORDER_ID, QUANTITY, BASE_UNIT_OF_MEASURE, POSTING_DATE, MOVEMENT_TYPE,
      CONCAT('|', :material_id, ':', :batch_id, '|',
             PARENT_MATERIAL_ID, ':', PARENT_BATCH_ID, '|') AS path
    FROM {tbl}
    WHERE CHILD_MATERIAL_ID = :material_id AND CHILD_BATCH_ID = :batch_id
      AND {_null_guard}
    UNION ALL
    SELECT
      t.hop_depth + 1, 'upstream',
      e.PARENT_MATERIAL_ID, e.PARENT_BATCH_ID, e.PARENT_PLANT_ID,
      e.CHILD_MATERIAL_ID, e.CHILD_BATCH_ID, e.CHILD_PLANT_ID,
      e.LINK_TYPE, e.PROCESS_ORDER_ID, e.MATERIAL_DOCUMENT_NUMBER,
      e.PURCHASE_ORDER_ID, e.SUPPLIER_ID, e.CUSTOMER_ID, e.DELIVERY_ID,
      e.SALES_ORDER_ID, e.QUANTITY, e.BASE_UNIT_OF_MEASURE, e.POSTING_DATE, e.MOVEMENT_TYPE,
      CONCAT(t.path, e.PARENT_MATERIAL_ID, ':', e.PARENT_BATCH_ID, '|')
    FROM {tbl} e
    JOIN us t
      ON e.CHILD_MATERIAL_ID = t.PARENT_MATERIAL_ID
      AND e.CHILD_BATCH_ID = t.PARENT_BATCH_ID
      AND e.CHILD_PLANT_ID <=> t.PARENT_PLANT_ID
    WHERE t.hop_depth < :max_depth
      AND e.PARENT_MATERIAL_ID IS NOT NULL AND e.PARENT_BATCH_ID IS NOT NULL
      AND INSTR(t.path, CONCAT('|', e.PARENT_MATERIAL_ID, ':', e.PARENT_BATCH_ID, '|')) = 0
  )"""

    # gold_material also has BASE_UNIT_OF_MEASURE, so selecting m_parent/m_child columns
    # alongside unqualified CTE columns causes an AMBIGUOUS_REFERENCE error in Databricks SQL.
    # Fix: wrap each CTE arm in a subquery (_lin) so its columns are all unambiguous, then
    # LEFT JOIN gold_material on the outer query and select _lin.* plus the two name columns.
    select_cols = """\
    hop_depth, traversal_dir,
    PARENT_MATERIAL_ID AS parent_material_id, PARENT_BATCH_ID AS parent_batch_id, PARENT_PLANT_ID AS parent_plant_id,
    CHILD_MATERIAL_ID AS child_material_id, CHILD_BATCH_ID AS child_batch_id, CHILD_PLANT_ID AS child_plant_id,
    LINK_TYPE AS link_type, PROCESS_ORDER_ID AS process_order_id, MATERIAL_DOCUMENT_NUMBER AS material_document_number,
    PURCHASE_ORDER_ID AS purchase_order_id, SUPPLIER_ID AS supplier_id, CUSTOMER_ID AS customer_id,
    DELIVERY_ID AS delivery_id, SALES_ORDER_ID AS sales_order_id, QUANTITY AS quantity,
    BASE_UNIT_OF_MEASURE AS base_unit_of_measure, POSTING_DATE AS posting_date, MOVEMENT_TYPE AS movement_type"""

    mat_select = "    m_parent.MATERIAL_NAME AS parent_material_name, m_child.MATERIAL_NAME AS child_material_name"
    # :language_id is a QuerySpec param (default 'E') so callers can override for non-English
    # environments without touching SQL. Verified live: connected_plant_uat uses 'E', not 'EN'.
    mat_joins = (
        f"LEFT JOIN {tbl_material} m_parent"
        f" ON _lin.parent_material_id = m_parent.MATERIAL_ID AND m_parent.LANGUAGE_ID = :language_id\n"
        f"LEFT JOIN {tbl_material} m_child"
        f" ON _lin.child_material_id = m_child.MATERIAL_ID AND m_child.LANGUAGE_ID = :language_id"
    )

    # P0-4: LIMIT is applied inside the _lin subquery so rows are capped before
    # gold_material JOIN executes — avoids enriching rows that will be discarded.
    # The Python loop in the route applies a second max_edges check on distinct
    # edge keys; both limits work together.
    # For UNION ALL (direction="both"), LIMIT wraps the whole union so it caps
    # the combined result, not each arm individually.
    if request.direction == "downstream":
        sql = (
            f"WITH RECURSIVE\n{ds_cte}\n"
            f"SELECT _lin.*,\n{mat_select}\n"
            f"FROM (SELECT DISTINCT\n{select_cols}\nFROM ds\nLIMIT :max_rows) AS _lin\n"
            f"{mat_joins}"
        )
    elif request.direction == "upstream":
        sql = (
            f"WITH RECURSIVE\n{us_cte}\n"
            f"SELECT _lin.*,\n{mat_select}\n"
            f"FROM (SELECT DISTINCT\n{select_cols}\nFROM us\nLIMIT :max_rows) AS _lin\n"
            f"{mat_joins}"
        )
    else:  # both — two independent recursive CTEs in one WITH RECURSIVE block
        # NOTE: direction="both" is never called from the route — the route splits
        # "both" into two parallel single-direction queries to avoid Databricks'
        # RECURSION_ROW_LIMIT_EXCEEDED (1M intermediate-row cap). A combined
        # UNION ALL query cannot carry per-arm LIMITs (parse error), so the route
        # handles the split. This branch is retained for direct adapter use only.
        sql = (
            f"WITH RECURSIVE\n{ds_cte},\n{us_cte}\n"
            f"SELECT _lin.*,\n{mat_select}\n"
            f"FROM (\n"
            f"SELECT * FROM (\n"
            f"SELECT DISTINCT\n{select_cols}\nFROM ds\n"
            f"UNION ALL\n"
            f"SELECT DISTINCT\n{select_cols}\nFROM us\n"
            f") AS _combined\nLIMIT :max_rows\n"
            f") AS _lin\n"
            f"{mat_joins}"
        )

    return QuerySpec(
        name="trace2.get_trace_graph",
        module="trace2",
        endpoint="/api/trace2/trace-graph",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_depth": request.max_depth,
            "max_rows": request.max_edges,
            "language_id": "E",
        },
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
    anchor_key = _node_key(request.material_id, request.batch_id)

    nodes: dict[str, dict] = {
        anchor_key: {
            "id": anchor_key,
            "materialId": request.material_id,
            "materialDescription": "",  # Anchor description often unknown without extra hop
            "batchId": request.batch_id,
            "plantId": request.plant_id,
            "depth": 0,
            "directions": ["anchor"],
            "isAnchor": True,
        }
    }
    edges: dict[str, dict] = {}
    warnings: list[str] = []

    for row, hop, direction in tagged_rows:
        parent_key = _node_key(row["parent_material_id"], row["parent_batch_id"])
        child_key = _node_key(row["child_material_id"], row["child_batch_id"])

        # Assign depth: for downstream the parent was found at hop, child is one step further.
        # For upstream the child was found at hop, parent is one step further.
        if direction == "downstream":
            parent_depth, child_depth = hop, hop + 1
        else:
            parent_depth, child_depth = hop + 1, hop

        if parent_key not in nodes:
            nodes[parent_key] = _make_graph_node(row, "parent", parent_depth, direction)
        else:
            if direction not in nodes[parent_key]["directions"]:
                nodes[parent_key]["directions"].append(direction)
            if not nodes[parent_key].get("materialDescription"):
                nodes[parent_key]["materialDescription"] = row.get("parent_material_name") or ""

        if child_key not in nodes:
            nodes[child_key] = _make_graph_node(row, "child", child_depth, direction)
        else:
            if direction not in nodes[child_key]["directions"]:
                nodes[child_key]["directions"].append(direction)
            if not nodes[child_key].get("materialDescription"):
                nodes[child_key]["materialDescription"] = row.get("child_material_name") or ""

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

    upstream_count = sum(1 for n in nodes.values() if "upstream" in n["directions"])
    downstream_count = sum(1 for n in nodes.values() if "downstream" in n["directions"])
    unresolved_count = sum(1 for n in nodes.values() if n.get("status") == "unresolved")

    return {
        "nodes": list(nodes.values()),
        "edges": list(edges.values()),
        "direction": request.direction,
        "depth": depth_reached,
        "rootBatch": f"{request.material_id}/{request.batch_id}",
        "upstreamCount": upstream_count,
        "downstreamCount": downstream_count,
        "unresolvedNodeCount": unresolved_count,
        "warnings": warnings,
        "truncated": truncated,
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
        "confidence": max(0.0, 1.0 - unresolved / max(1, len(rows))),
        "unresolvedMovements": unresolved,
        "movements": movements,
    }


# ---------------------------------------------------------------------------
# Slice 4 — getCustomerExposureSummary (lineage-only first slice)
# ---------------------------------------------------------------------------

def get_customer_exposure_spec(request: Trace2CustomerExposureRequest) -> QuerySpec:
    """Return a QuerySpec for getCustomerExposureSummary — lineage-only first slice.

    Source: gold_batch_lineage downstream WITH RECURSIVE, filtering LINK_TYPE = 'DELIVERY'
    edges where CUSTOMER_ID IS NOT NULL.

    Source confidence (2026-05-20):
      - gold_batch_lineage columns confirmed live 2026-05-19.
      - CUSTOMER_ID column confirmed present in all 18 columns.
      - LINK_TYPE = 'DELIVERY' value: Medium confidence — in _LINK_TYPE_MAP from V1 inspection
        but live LINK_TYPE values have not been validated against a Databricks session (P0-3).
      - CUSTOMER_ID population on DELIVERY edges: Medium confidence — column exists but
        sparsity on DELIVERY-type edges is unknown until UAT validation.
      - Countries: NOT available from gold_batch_lineage; deferred to gold_batch_delivery_v.
      - blockedDeliveries: NOT available from gold_batch_lineage; always 0 in this slice.

    Zero-rows semantics:
      The mapper returns None for zero rows. The route returns HTTP 404 with message
      "No customer delivery records returned from current source — do not interpret as
      zero exposure until source coverage is validated." The frontend adapter/panel must
      display this as unavailable, NOT as zero exposure.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_lineage")

    _null_guard = (
        "PARENT_MATERIAL_ID IS NOT NULL AND PARENT_BATCH_ID IS NOT NULL"
        " AND CHILD_MATERIAL_ID IS NOT NULL AND CHILD_BATCH_ID IS NOT NULL"
    )

    sql = f"""
    WITH RECURSIVE
    ds AS (
      SELECT
        1 AS hop_depth,
        PARENT_MATERIAL_ID, PARENT_BATCH_ID, PARENT_PLANT_ID,
        CHILD_MATERIAL_ID, CHILD_BATCH_ID, CHILD_PLANT_ID,
        LINK_TYPE, CUSTOMER_ID, DELIVERY_ID, SALES_ORDER_ID,
        QUANTITY, BASE_UNIT_OF_MEASURE, POSTING_DATE,
        CONCAT('|', :material_id, ':', :batch_id, '|',
               CHILD_MATERIAL_ID, ':', CHILD_BATCH_ID, '|') AS path
      FROM {tbl}
      WHERE PARENT_MATERIAL_ID = :material_id AND PARENT_BATCH_ID = :batch_id
        AND (:plant_id = '' OR PARENT_PLANT_ID = :plant_id)
        AND {_null_guard}
      UNION ALL
      SELECT
        t.hop_depth + 1,
        e.PARENT_MATERIAL_ID, e.PARENT_BATCH_ID, e.PARENT_PLANT_ID,
        e.CHILD_MATERIAL_ID, e.CHILD_BATCH_ID, e.CHILD_PLANT_ID,
        e.LINK_TYPE, e.CUSTOMER_ID, e.DELIVERY_ID, e.SALES_ORDER_ID,
        e.QUANTITY, e.BASE_UNIT_OF_MEASURE, e.POSTING_DATE,
        CONCAT(t.path, e.CHILD_MATERIAL_ID, ':', e.CHILD_BATCH_ID, '|')
      FROM {tbl} e
      JOIN ds t
        ON e.PARENT_MATERIAL_ID = t.CHILD_MATERIAL_ID
        AND e.PARENT_BATCH_ID = t.CHILD_BATCH_ID
        AND e.PARENT_PLANT_ID <=> t.CHILD_PLANT_ID
      WHERE t.hop_depth < :max_depth
        AND e.CHILD_MATERIAL_ID IS NOT NULL AND e.CHILD_BATCH_ID IS NOT NULL
        AND INSTR(t.path, CONCAT('|', e.CHILD_MATERIAL_ID, ':', e.CHILD_BATCH_ID, '|')) = 0
    )
    SELECT
      CUSTOMER_ID    AS customer_id,      -- confirmed column: gold_batch_lineage (all 18 cols, 2026-05-19)
      DELIVERY_ID    AS delivery_id,      -- confirmed column: gold_batch_lineage
      SALES_ORDER_ID AS sales_order_id,   -- confirmed column: gold_batch_lineage
      QUANTITY       AS quantity,         -- confirmed column: gold_batch_lineage
      BASE_UNIT_OF_MEASURE AS base_unit_of_measure,  -- confirmed column: gold_batch_lineage
      POSTING_DATE   AS posting_date,     -- confirmed column: gold_batch_lineage
      hop_depth                           -- from recursive CTE above
    FROM ds
    WHERE LINK_TYPE = 'DELIVERY'          -- Medium confidence: from _LINK_TYPE_MAP (V1 inspection); P0-3 live validation pending
      AND CUSTOMER_ID IS NOT NULL         -- exclude edges without customer attribution
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_customer_exposure",
        module="trace2",
        endpoint="/api/trace2/customer-exposure",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
            "max_depth": request.max_depth,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_lineage",
        tags=["trace2", "customer-exposure", "lineage"],
    )


def map_customer_exposure_rows(rows: list[dict]) -> Optional[dict]:
    """Map Databricks customer exposure rows to CustomerExposureSummarySchema shape.

    Zero rows → returns None. Caller must return HTTP 404 with "do not interpret as
    zero exposure" message. This is NOT the same as zero affected customers.

    Severity: 'medium' (preliminary — business severity rules not yet defined).
    Countries: [] — gold_batch_lineage has no country column; deferred to gold_batch_delivery_v.
    blockedDeliveries: 0 — blocked status requires gold_batch_delivery_v; deferred.
    recallRecommended: False — recall rules not yet defined; deferred.

    Leading zeros in customer/delivery IDs are preserved (str, not numeric).
    """
    if not rows:
        return None

    customers: set[str] = set()
    deliveries: set[str] = set()
    total_qty = 0.0
    min_depth: Optional[int] = None

    for row in rows:
        cid = row.get("customer_id")
        if cid is not None:
            customers.add(str(cid))
        did = row.get("delivery_id")
        if did is not None:
            deliveries.add(str(did))
        qty = row.get("quantity")
        if qty is not None:
            total_qty += float(qty)
        depth = row.get("hop_depth")
        if depth is not None:
            d = int(depth)
            if min_depth is None or d < min_depth:
                min_depth = d

    result: dict = {
        "affectedCustomers": len(customers),
        "affectedDeliveries": len(deliveries),
        "shippedQuantity": total_qty,
        "countries": [],        # deferred — gold_batch_lineage has no country column
        "highestSeverity": "medium",  # preliminary — severity rules not yet defined
        "blockedDeliveries": 0,       # deferred — requires gold_batch_delivery_v
        "recallRecommended": False,
        "deliveryEvidenceSource": "lineage",
    }
    if min_depth is not None:
        result["maxExposureDepth"] = min_depth
    return result


# ---------------------------------------------------------------------------
# Slice 5 — getCustomerDeliveryRecords (gold_batch_delivery_v, V1-parity)
# ---------------------------------------------------------------------------

def get_customer_delivery_spec(request: Trace2CustomerDeliveryRequest) -> QuerySpec:
    """Return a QuerySpec for getCustomerDeliveryRecords — V1-parity delivery view slice.

    Source: gold_batch_delivery_v keyed on MATERIAL_ID + BATCH_ID.
    No plant filter — all delivery plants must be included for recall coverage.
    See customer-delivery-v1-parity-source-mapping.md for source decision.

    Column confidence (2026-05-20):
      - DELIVERY, CUSTOMER_ID, CUSTOMER_NAME, COUNTRY_ID, CITY, ABS_QUANTITY: High
        (confirmed from trace2-functional-parity-audit.md §3 and Slice 4 plan)
      - POSTING_DATE: High (user confirmed 2026-05-20)
      - MATERIAL_ID, BATCH_ID as WHERE keys: Pending DESCRIBE TABLE confirmation
        (consistent with all other gold views; must be verified in UAT session)

    Zero-rows semantics:
      The mapper returns None for zero rows. The route returns HTTP 404 with message
      "No customer delivery records returned — do not interpret as zero exposure."

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_delivery_v")

    sql = f"""
    SELECT
      DELIVERY        AS delivery,        -- confirmed: gold_batch_delivery_v (High confidence)
      CUSTOMER_ID     AS customer_id,     -- confirmed: gold_batch_delivery_v (High confidence)
      CUSTOMER_NAME   AS customer_name,   -- confirmed: gold_batch_delivery_v (High confidence)
      COUNTRY_ID      AS country_id,      -- confirmed: gold_batch_delivery_v (High confidence)
      CITY            AS city,            -- confirmed: gold_batch_delivery_v (High confidence)
      ABS_QUANTITY    AS abs_quantity,    -- confirmed: gold_batch_delivery_v (High confidence)
      POSTING_DATE    AS posting_date     -- confirmed: gold_batch_delivery_v (user confirmed 2026-05-20)
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id  -- TODO: verify column name via DESCRIBE TABLE (expected consistent with all gold views)
      AND BATCH_ID   = :batch_id      -- TODO: verify column name via DESCRIBE TABLE
      AND DELIVERY IS NOT NULL
      AND CUSTOMER_ID IS NOT NULL
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_customer_deliveries",
        module="trace2",
        endpoint="/api/trace2/customer-deliveries",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_delivery_v",
        tags=["trace2", "customer-deliveries", "delivery-view"],
    )


def map_customer_delivery_rows(rows: list[dict]) -> Optional[dict]:
    """Map gold_batch_delivery_v rows to CustomerExposureSummarySchema shape.

    Zero rows → returns None. Caller must return HTTP 404 with "do not interpret as
    zero exposure" message.

    shippedQuantity: sum of abs_quantity (no de-netting of 602 reversals — see
      customer-delivery-movement-type-validation.md §Reversal Handling for escalation criteria).
    countries: distinct non-null COUNTRY_ID values as strings.
    blockedDeliveries: 0 — no confirmed blocked-status column in gold_batch_delivery_v yet.
    highestSeverity: 'medium' — preliminary; business rules not yet defined for V2.
    maxExposureDepth: not set — gold_batch_delivery_v is direct delivery records, not hop-based.
    deliveryEvidenceSource: 'inventory-movements' — signals V1-parity delivery view source.
    """
    if not rows:
        return None

    deliveries: set[str] = set()
    customers: set[str] = set()
    countries: set[str] = set()
    total_qty = 0.0

    for row in rows:
        did = row.get("delivery")
        if did is not None:
            deliveries.add(str(did))
        cid = row.get("customer_id")
        if cid is not None:
            customers.add(str(cid))
        ctry = row.get("country_id")
        if ctry is not None:
            countries.add(str(ctry))
        qty = row.get("abs_quantity")
        if qty is not None:
            total_qty += float(qty)

    return {
        "affectedCustomers": len(customers),
        "affectedDeliveries": len(deliveries),
        "shippedQuantity": total_qty,
        "countries": sorted(countries),
        "highestSeverity": "medium",    # preliminary — severity rules not yet defined
        "blockedDeliveries": 0,         # deferred — no confirmed blocked-status column
        "recallRecommended": False,
        "deliveryEvidenceSource": "inventory-movements",
    }


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _node_key(material_id: str, batch_id: str) -> str:
    """Unique key for a batch node — 2-tuple (material_id:batch_id).

    plant_id intentionally excluded: a batch is identified by material+batch
    regardless of plant. plantId is stored on each node for display but does
    not participate in dedup or cycle detection.
    """
    return f"{material_id}:{batch_id}"


def _make_graph_node(row: dict, side: str, depth: int, direction: str) -> dict:
    prefix = "parent" if side == "parent" else "child"
    mat = row[f"{prefix}_material_id"]
    bat = row[f"{prefix}_batch_id"]
    pla = row[f"{prefix}_plant_id"]
    return {
        "id": _node_key(mat, bat),
        "materialId": mat,
        "materialDescription": row.get(f"{prefix}_material_name") or row.get("material_name") or "",
        "batchId": bat,
        "plantId": pla,
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
        "uom": row.get("uom") or row.get("base_unit_of_measure"),
        "postingDate": row.get("posting_date"),
        "movementType": row.get("movement_type"),
    }


# NOTE: _LINK_TYPE_MAP is documentation-only. The live linkType string is passed
# raw in _make_graph_edge and the frontend mapper (trace2-graph-mapper.ts) owns
# the linkType → relationshipType translation. This dict is kept here as a
# reference for what LINK_TYPE values gold_batch_lineage may emit, and to keep
# the Python and TypeScript mapping tables in sync.
# P0-3: VENDOR_RECEIPT and CONSUMPTION are distinct traceability events and must
# NOT be conflated — see trace2-graph-mapper.ts LINK_TYPE_MAP for the canonical mapping.
_LINK_TYPE_MAP: dict[str, str] = {
    "PRODUCTION": "produced-from",
    "BATCH_TRANSFER": "transferred-to",
    "STO_TRANSFER": "transferred-to",
    "VENDOR_RECEIPT": "vendor-receipt",   # inbound goods receipt from external supplier
    "CONSUMPTION": "consumed-by",          # component consumed into a production order
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
    # Not called by _make_graph_edge (raw linkType is passed through to the frontend).
    # Retained for test/validation use only.
    return _LINK_TYPE_MAP.get((raw or "").upper().strip(), "component-of")


def _map_movement_category(raw: Optional[str]) -> str:
    return _MOVEMENT_CATEGORY_MAP.get((raw or "").upper().strip(), "adjustment")


def _map_batch_status(raw: Optional[str]) -> str:
    if raw is None:
        return "unknown"
    return _BATCH_STATUS_MAP.get(str(raw).upper().strip(), "unknown")


def _derive_stock_status(row: dict) -> str:
    def qty(col: str) -> float:
        return float(row.get(col) or 0)

    if qty("blocked") > 0:
        return "blocked"
    if qty("quality_inspection") > 0:
        return "quality-inspection"
    if qty("restricted") > 0:
        return "restricted"
    if qty("transit") > 0:
        return "transit"
    return "unrestricted"


def _derive_quality_status(row: dict) -> str:
    """Derive quality status from available batch stock data.

    IMPORTANT: quality_inspection is a stock disposition quantity (QI stock),
    not a QM usage decision. QI stock > 0 means stock is held under quality
    inspection, which justifies 'pending' (open inspection). However, it does
    NOT mean the batch was accepted or rejected — those require an actual QM
    inspection-lot usage decision field that is not present in the current query.

    Returns:
        'pending'  — QI stock is non-zero (open quality inspection in progress).
        'unknown'  — No QI stock and no QM decision field available from this
                     source. Do NOT interpret 'unknown' as 'accepted'. Use
                     'not-applicable' only when quality inspection is structurally
                     not applicable to this batch type (e.g., re-packed or
                     non-regulated materials) — that distinction requires a
                     verified QM inspection type / usage decision field.

    Blocked validation: to return 'accepted', 'rejected', or 'conditional', a
    verified QM usage decision / inspection lot decision field is required.
    The query must be extended to join or select from a QM decisions view (e.g.,
    gold_qm_usage_decision_v or equivalent). Until that field is verified in UAT,
    this function returns 'unknown' rather than guessing.
    """
    if float(row.get("quality_inspection") or 0) > 0:
        return "pending"
    return "unknown"


def _derive_release_status(raw: Optional[str]) -> str:
    if raw is None:
        return "unknown"
    return _RELEASE_STATUS_MAP.get(str(raw).upper().strip(), "unknown")
