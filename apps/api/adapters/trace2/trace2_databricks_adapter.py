"""Trace Investigation Databricks-api adapter — QuerySpec factories and row mapping.

Implemented slices:
  - get_batch_header_summary_spec / map_batch_header_rows
  - get_trace_graph_recursive_spec / map_trace_graph
  - get_mass_balance_spec / map_mass_balance_rows
  - get_customer_exposure_spec / map_customer_exposure_rows  (lineage-only first slice)
  - get_customer_delivery_spec / map_customer_delivery_rows  (gold_batch_delivery_v, V1-parity)

Column name verification status (live validation 2026-05-19/2026-05-20, connected_plant_uat):
  - gold_batch_summary_v: MANUFACTURE_DATE and SHELF_LIFE_EXPIRATION_DATE verified. PLANT_ID,
    BATCH_STATUS, UOM, PROCESS_ORDER_ID are NOT present in this view. plant_id sourced from
    gold_batch_stock_v; uom from gold_material.BASE_UNIT_OF_MEASURE.
  - gold_batch_stock_v: column names confirmed from V1 inspection (see trace2-functional-parity-audit.md §3).
    PLANT_ID also confirmed live.
  - gold_material: LANGUAGE_ID = 'E' (not 'EN'), MATERIAL_NAME, BASE_UNIT_OF_MEASURE verified live.
  - gold_plant: PLANT_ID, PLANT_NAME confirmed from V1 inspection.
  - gold_batch_lineage: all 18 columns confirmed — see trace2-functional-parity-audit.md §3.
  - gold_batch_delivery_v: all 17 columns verified live 2026-05-20 (DESCRIBE TABLE confirmed
    MATERIAL_ID + BATCH_ID as WHERE keys; UOM, COUNTRY_NAME, SALES_ORDER_ID, MOVEMENT_TYPE added).
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
    max_rows: int = 5000


@dataclass
class Trace2SupplierExposureRequest:
    material_id: str
    batch_id: str
    max_rows: int = 1000


@dataclass
class Trace2ProductionHistoryRequest:
    material_id: str
    max_rows: int = 24   # V1 parity: most-recent 24 batches


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


@dataclass
class Trace2RecallReadinessRequest:
    """Trace App / Recall & Exposure tab.

    No plant filter — recall coverage must span all plants the batch reached.
    """
    material_id: str
    batch_id: str
    max_rows: int = 10000


@dataclass
class Trace2SupplierBatchViewRequest:
    """Trace App / Supplier Batches tab.

    Two sub-queries are issued:
      1) consumedLots — single-hop upstream VENDOR_RECEIPT edges
      2) siblingBatches — cross-plant batches that consumed any of the same vendor lots
    Plant is intentionally NOT filtered for sibling discovery.
    """
    material_id: str
    batch_id: str
    max_rows: int = 5000


@dataclass
class Trace2BatchQualityPassportRequest:
    """Trace App / Quality Passport tab — full real-data implementation.

    Fans out across 5 gold views: stock_v, summary_v, material, plant,
    production_history_v (identity/stock/production), quality_result_v (CoA),
    quality_lot_v (lot history + signoff), quality_summary_v (KPIs),
    mass_balance_v (variance).
    """
    material_id: str
    batch_id: str
    plant_id: str = ""


@dataclass
class Trace2MassBalanceLedgerRequest:
    """Trace App / Mass Balance tab — ledger of MSEG-style movements."""
    material_id: str
    batch_id: str
    plant_id: str = ""
    max_rows: int = 5000


@dataclass
class Trace2InvestigationTimelineRequest:
    """Trace App / Timeline tab — UNION of events across mass-balance,
    quality-lot, and delivery sources."""
    material_id: str
    batch_id: str
    plant_id: str = ""
    max_rows: int = 1000


@dataclass
class Trace2HoldsLedgerRequest:
    """Trace App / Holds tab — derived from stock_v (current qty-by-reason)
    and quality_lot_v (inspection-driven active/resolved holds)."""
    material_id: str
    batch_id: str
    plant_id: str = ""
    max_rows: int = 500


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
    JOIN `ds` t
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
    JOIN `us` t
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

    Column verification status (verified live 2026-05-20, connected_plant_uat):
      - 11 columns confirmed via DESCRIBE TABLE: MATERIAL_ID, BATCH_ID, PLANT_ID,
        MOVEMENT_TYPE, QUANTITY (signed), UOM, PROCESS_ORDER_ID, POSTING_DATE,
        ABS_QUANTITY, BALANCE_QTY, MOVEMENT_CATEGORY.
      - WHERE keys material_id + batch_id confirmed.
      - SELECT uses lowercase column names; Databricks Statement API returns
        keys in the same case as the SELECT clause (verified live).

    Known correctness gaps (see traceability-defect-backlog.md):
      - TRACE-P1-010: MOVEMENT_CATEGORY mapping is incomplete. Live values include
        "STO Receipt", "STO Transfer", "Other (261)", "Write-Off" — none match
        _MOVEMENT_CATEGORY_MAP, all fall through to "adjustment". STO Receipt is
        an incoming movement but is currently treated as output. Pending a
        verified category-to-direction map. The mapper counts unmapped rows as
        unresolvedMovements so the panel's warning banner reflects truth.
      - TRACE-P1-011: BALANCE_QTY returned 0.000 for all 30+ rows of the UAT
        candidate (20035129 / 8000049668). The view's "balance_qty" column does
        not appear to be a per-batch running balance. Pending source verification
        with the data platform team.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl_mass_balance = resolve_domain_object("trace2", "gold_batch_mass_balance_v")

    sql = f"""
    SELECT
        posting_date,
        movement_type,
        movement_category,
        abs_quantity,
        uom,
        balance_qty
    FROM {tbl_mass_balance}
    WHERE material_id = :material_id
      AND batch_id = :batch_id
    ORDER BY posting_date
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_mass_balance",
        module="trace2",
        endpoint="/api/trace2/mass-balance",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_rows": request.max_rows,
        },
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

    unresolvedMovements:
      - rows with null balance_qty
      - rows whose movement_category did not match a known mapping in
        _MOVEMENT_CATEGORY_MAP (live values like "STO Receipt", "STO Transfer",
        "Other (NNN)", "Write-Off" currently fall through — see TRACE-P1-010).
      Counts are unioned (a row that fails both still counts once).

    balance_qty is mapped to runningBalance but live evidence shows the column
    is not a per-batch running tally (see TRACE-P1-011). Treat the field as
    movement-level snapshot until source semantics are verified.
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
        raw_category = row.get("movement_category")
        category = _map_movement_category(raw_category)
        abs_qty = float(row.get("abs_quantity") or 0)

        if category == "production":
            input_qty += abs_qty
            delta = abs_qty
        else:
            output_qty += abs_qty
            delta = -abs_qty

        balance_qty = row.get("balance_qty")
        category_unmapped = _is_unmapped_movement_category(raw_category, category)
        if balance_qty is None or category_unmapped:
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
      JOIN `ds` t
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
    FROM `ds`
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
        # null = no governed recall-rule source available. Contract was relaxed
        # to z.boolean().nullable() so we can stop emitting `false` (which would
        # read as "recall not required"). See PR brief Part A.
        "recallRecommended": None,
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

    Column confidence (verified live 2026-05-20, DESCRIBE TABLE connected_plant_uat.gold.gold_batch_delivery_v):
      17 columns confirmed: MATERIAL_ID, BATCH_ID, PLANT_ID, CUSTOMER_ID, CUSTOMER_NAME,
      STREET, CITY, POSTCODE, COUNTRY_ID, COUNTRY_NAME, DELIVERY, SALES_ORDER_ID,
      QUANTITY (signed), ABS_QUANTITY, UOM, POSTING_DATE, MOVEMENT_TYPE.
      WHERE keys MATERIAL_ID + BATCH_ID confirmed. UOM confirmed as string column.

    Zero-rows semantics:
      The mapper returns None for zero rows. The route returns HTTP 404 with message
      "No customer delivery records returned — do not interpret as zero exposure."

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_delivery_v")

    sql = f"""
    SELECT
      DELIVERY        AS delivery,
      CUSTOMER_ID     AS customer_id,
      CUSTOMER_NAME   AS customer_name,
      COUNTRY_ID      AS country_id,
      COUNTRY_NAME    AS country_name,
      CITY            AS city,
      ABS_QUANTITY    AS abs_quantity,
      UOM             AS uom,
      POSTING_DATE    AS posting_date
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
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
    uom: first non-null UOM value (consistent across a material/batch; absent if all null).
    blockedDeliveries: 0 — no confirmed blocked-status column in gold_batch_delivery_v.
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
    uom: Optional[str] = None

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
        if uom is None and row.get("uom") is not None:
            uom = str(row["uom"])

    result: dict = {
        "affectedCustomers": len(customers),
        "affectedDeliveries": len(deliveries),
        "shippedQuantity": total_qty,
        "countries": sorted(countries),
        "highestSeverity": "medium",    # preliminary — severity rules not yet defined
        "blockedDeliveries": 0,         # deferred — no confirmed blocked-status column
        # null = no governed recall-rule source available. See PR brief Part A.
        "recallRecommended": None,
        "deliveryEvidenceSource": "inventory-movements",
    }
    if uom is not None:
        result["uom"] = uom
    return result


# ---------------------------------------------------------------------------
# Slice 6 — getSupplierExposureSummary (gold_batch_lineage VENDOR_RECEIPT + gold_supplier)
# ---------------------------------------------------------------------------

def get_supplier_exposure_spec(request: Trace2SupplierExposureRequest) -> QuerySpec:
    """Return a QuerySpec for getSupplierExposureSummary — V1-parity supplier slice.

    Source: single-hop upstream VENDOR_RECEIPT walk from gold_batch_lineage joined
    to gold_supplier on SUPPLIER_ID. Returns one row per distinct supplier with
    aggregated quantity, receipt count, last-receipt date, and uom.

    Empty-string SUPPLIER_ID handling: lineage rows where SUPPLIER_ID is NULL or
    empty string ('') are filtered at SQL. Live data on 2026-05-20 showed 9 of 10
    direct-parent VENDOR_RECEIPT rows for the UAT candidate had SUPPLIER_ID = ''.
    These represent unattributed inputs (intra-company transfers, missing data)
    and are not real third-party suppliers; they are excluded by design.

    Multi-hop walks are out of scope for this first slice. The query returns
    direct-parent VENDOR_RECEIPT suppliers only. Multi-hop is a separate concern
    (would need a recursive CTE; not in scope here).

    openSupplierActions and highestRiskSupplier are NOT populated — a verified
    QM source is required. See TRACE-P1-012.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl_lineage = resolve_domain_object("trace2", "gold_batch_lineage")
    tbl_supplier = resolve_domain_object("trace2", "gold_supplier")

    sql = f"""
    SELECT
        l.SUPPLIER_ID            AS supplier_id,
        s.SUPPLIER_NAME          AS supplier_name,
        s.COUNTRY_ID             AS country_id,
        s.COUNTRY_NAME           AS country_name,
        SUM(l.QUANTITY)          AS received_quantity,
        COUNT(*)                 AS receipt_count,
        COUNT(DISTINCT l.PARENT_MATERIAL_ID) AS upstream_material_count,
        MAX(l.POSTING_DATE)      AS last_receipt_date,
        MAX(l.BASE_UNIT_OF_MEASURE) AS uom
    FROM {tbl_lineage} l
    LEFT JOIN {tbl_supplier} s ON l.SUPPLIER_ID = s.SUPPLIER_ID
    WHERE l.CHILD_MATERIAL_ID = :material_id
      AND l.CHILD_BATCH_ID    = :batch_id
      AND l.LINK_TYPE         = 'VENDOR_RECEIPT'
      AND l.SUPPLIER_ID IS NOT NULL
      AND l.SUPPLIER_ID <> ''
    GROUP BY l.SUPPLIER_ID, s.SUPPLIER_NAME, s.COUNTRY_ID, s.COUNTRY_NAME
    ORDER BY received_quantity DESC
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_supplier_exposure",
        module="trace2",
        endpoint="/api/trace2/supplier-exposure",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_lineage+gold_supplier",
        tags=["trace2", "supplier-exposure", "vendor-receipt"],
    )


def map_supplier_exposure_rows(rows: list[dict]) -> dict:
    """Map aggregated supplier rows to SupplierExposureSummarySchema shape.

    Empty rows → returns a zero-supplier summary (not None). Distinct from the
    customer-exposure 404 pattern: a batch with zero direct VENDOR_RECEIPT
    suppliers may genuinely be a production-only batch with no purchased inputs.
    The panel surfaces zero-supplier state explicitly.

    Mapped fields:
      supplierCount     = number of distinct suppliers in the result rows
      supplierLots      = total receipt count across suppliers (proxy for "lots received")
      upstreamMaterials = sum of distinct upstream material counts across suppliers
      openSupplierActions = 0 (no QM source)  -- TRACE-P1-012
      highestRiskSupplier = absent (no QM source)
      suppliers          = per-supplier detail array

    receivedQuantity is summed per supplier in SQL; uom is taken from MAX(BASE_UNIT_OF_MEASURE)
    which assumes a supplier's receipts share a UoM. Mixed-UoM cases are rare for a
    given material/batch input; not handled in this slice.
    """
    suppliers: list[dict] = []
    total_lots = 0
    total_upstream_materials = 0

    for row in rows:
        supplier_id = row.get("supplier_id") or ""
        if not supplier_id:
            continue
        received_quantity = float(row.get("received_quantity") or 0)
        receipt_count = int(row.get("receipt_count") or 0)
        upstream_material_count = int(row.get("upstream_material_count") or 0)
        total_lots += receipt_count
        total_upstream_materials += upstream_material_count
        detail: dict = {
            "supplierId": str(supplier_id),
            "receivedQuantity": received_quantity,
            "batchCount": receipt_count,
        }
        if row.get("supplier_name") is not None:
            detail["supplierName"] = str(row["supplier_name"])
        if row.get("country_id") is not None:
            detail["countryId"] = str(row["country_id"])
        if row.get("country_name") is not None:
            detail["countryName"] = str(row["country_name"])
        if row.get("uom") is not None:
            detail["uom"] = str(row["uom"])
        if row.get("last_receipt_date") is not None:
            detail["lastReceiptDate"] = str(row["last_receipt_date"])
        suppliers.append(detail)

    return {
        "supplierCount": len(suppliers),
        "supplierLots": total_lots,
        "upstreamMaterials": total_upstream_materials,
        "openSupplierActions": 0,   # TRACE-P1-012: no verified QM source
        "suppliers": suppliers,
    }


# ---------------------------------------------------------------------------
# Slice 7 — getProductionHistory (gold_batch_production_history_v)
# ---------------------------------------------------------------------------

def get_production_history_spec(request: Trace2ProductionHistoryRequest) -> QuerySpec:
    """Return a QuerySpec for getProductionHistory — V1-parity recent batches for a material.

    Source: gold_batch_production_history_v (8 columns verified live 2026-05-20).
    Filter: MATERIAL_ID only (no plant filter — V1 showed recent batches across all
    plants for the material to support "isolated vs systemic" assessment).

    Order: most-recent POSTING_DATE first. Default limit: 24 (V1 parity).

    quality_status values in live data: 'Pass' / 'Fail' (no NULLs observed). The
    mapper maps 'Pass' → 'pass', 'Fail' → 'fail', anything else → 'unknown'.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_production_history_v")
    sql = f"""
    SELECT
        PROCESS_ORDER_ID  AS process_order_id,
        BATCH_ID          AS batch_id,
        PLANT_ID          AS plant_id,
        MATERIAL_ID       AS material_id,
        POSTING_DATE      AS posting_date,
        BATCH_QTY         AS batch_qty,
        UOM               AS uom,
        quality_status    AS quality_status
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID IS NOT NULL
    ORDER BY POSTING_DATE DESC, BATCH_ID DESC
    LIMIT :max_rows
    """
    return QuerySpec(
        name="trace2.get_production_history",
        module="trace2",
        endpoint="/api/trace2/production-history",
        sql=sql,
        params={
            "material_id": request.material_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_production_history_v",
        tags=["trace2", "production-history"],
    )


def map_production_history_rows(rows: list[dict], material_id: str) -> dict:
    """Map gold_batch_production_history_v rows to ProductionHistorySummarySchema shape.

    Zero rows → returns a summary with totalBatches=0 and empty rows[]. The
    route still returns 200 (not 404): a material may legitimately have no
    recent production history (e.g., it's a raw-input material, not a
    manufactured product) and that information is informative.

    quality_status mapping: 'Pass' → 'pass', 'Fail' → 'fail',
    anything else (including null/empty) → 'unknown'.
    """
    mapped_rows: list[dict] = []
    pass_count = 0
    fail_count = 0
    unknown_count = 0

    for row in rows:
        raw_quality = row.get("quality_status")
        quality = _map_quality_status(raw_quality)
        if quality == "pass":
            pass_count += 1
        elif quality == "fail":
            fail_count += 1
        else:
            unknown_count += 1

        mapped_row: dict = {
            "batchId": str(row.get("batch_id") or ""),
            "materialId": str(row.get("material_id") or material_id),
            "quantity": float(row.get("batch_qty") or 0),
            "qualityStatus": quality,
        }
        if row.get("process_order_id") is not None:
            mapped_row["processOrderId"] = str(row["process_order_id"])
        if row.get("plant_id") is not None:
            mapped_row["plantId"] = str(row["plant_id"])
        if row.get("posting_date") is not None:
            mapped_row["postingDate"] = str(row["posting_date"])
        if row.get("uom") is not None:
            mapped_row["uom"] = str(row["uom"])
        mapped_rows.append(mapped_row)

    return {
        "materialId": material_id,
        "totalBatches": len(mapped_rows),
        "passCount": pass_count,
        "failCount": fail_count,
        "unknownCount": unknown_count,
        "rows": mapped_rows,
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


def _map_quality_status(raw: Optional[str]) -> str:
    """Map gold_batch_production_history_v.quality_status to the contract enum.

    Live values observed 2026-05-20: 'Pass' (1.96M rows), 'Fail' (296k rows).
    Anything else (including null and empty string) maps to 'unknown'.
    """
    if raw is None:
        return "unknown"
    text = str(raw).strip().lower()
    if text == "pass":
        return "pass"
    if text == "fail":
        return "fail"
    return "unknown"


def _is_unmapped_movement_category(raw: Optional[str], mapped: str) -> bool:
    """True when raw was non-null/non-empty but fell through the map to "adjustment".

    A raw value of None or empty string is intentionally not flagged — it means the
    source provided no category at all, which is a different (and rarer) condition
    than "we received a category but did not know what to do with it".
    """
    if raw is None:
        return False
    text = str(raw).strip()
    if not text:
        return False
    if mapped != "adjustment":
        return False
    # "adjustment"-like raw values (e.g. "ADJUSTMENT", "Adjustment") are not unmapped.
    return text.upper() != "ADJUSTMENT"


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


# ---------------------------------------------------------------------------
# Trace App slice — getRecallReadiness  (gold_batch_delivery_v aggregations)
# ---------------------------------------------------------------------------

def get_recall_readiness_spec(request: Trace2RecallReadinessRequest) -> QuerySpec:
    """Return a QuerySpec for the Trace App Recall & Exposure tab.

    Source: gold_batch_delivery_v (17 columns verified live 2026-05-20).
    No plant filter — recall coverage must surface all plants a batch reached.
    Returns one row per delivery so the mapper can produce both the per-country
    aggregate and the delivery-level table that the panel renders.

    Status semantics in this slice:
      - All rows are reported with status='delivered' because gold_batch_delivery_v
        does not yet expose an in-transit / blocked / recalled flag. When a
        delivery-status column lands, swap the mapper to honour it.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_delivery_v")

    sql = f"""
    SELECT
      DELIVERY         AS delivery,
      CUSTOMER_ID      AS customer_id,
      CUSTOMER_NAME    AS customer_name,
      COUNTRY_ID       AS country_id,
      COUNTRY_NAME     AS country_name,
      ABS_QUANTITY     AS abs_quantity,
      UOM              AS uom,
      POSTING_DATE     AS posting_date,
      SALES_ORDER_ID   AS sales_order_id
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
      AND DELIVERY IS NOT NULL
      AND CUSTOMER_ID IS NOT NULL
    ORDER BY POSTING_DATE DESC
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_recall_readiness",
        module="trace2",
        endpoint="/api/trace2/recall-readiness",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_delivery_v",
        tags=["trace2", "trace-app", "recall-readiness"],
    )


def map_recall_readiness_rows(rows: list[dict]) -> Optional[dict]:
    """Map gold_batch_delivery_v rows to RecallReadinessSchema.

    Zero rows → returns None. Caller returns HTTP 404 with "do not interpret
    as zero exposure" message.

    Country aggregation is derived from country_id + country_name pairs.
    Percentages are computed against total shipped quantity.
    """
    if not rows:
        return None

    deliveries: list[dict] = []
    customers: set[str] = set()
    country_totals: dict[str, dict] = {}
    total_qty = 0.0
    uom: Optional[str] = None

    for row in rows:
        did = str(row.get("delivery") or "")
        cid = str(row.get("customer_id") or "")
        cname = str(row.get("customer_name") or "")
        country_id = str(row.get("country_id") or "")
        country_name = str(row.get("country_name") or country_id)
        qty = float(row.get("abs_quantity") or 0)
        posting_date = row.get("posting_date")
        sales_order = row.get("sales_order_id")

        customers.add(cid)
        total_qty += qty

        if uom is None and row.get("uom") is not None:
            uom = str(row["uom"])

        if country_id:
            agg = country_totals.setdefault(country_id, {"code": country_id, "name": country_name, "qty": 0.0})
            agg["qty"] = float(agg["qty"]) + qty

        deliveries.append({
            "id": did,
            "customer": cname or cid,
            "country": country_id,
            "date": str(posting_date) if posting_date is not None else "",
            "qty": qty,
            # gold_batch_delivery_v has no delivery-status column. We emit
            # 'delivery-evidence' (source-truthful default) and tag the
            # provenance so the UI cannot misread it as governed delivery
            # status. When a status column lands, derive the real value.
            "status": "delivery-evidence",
            "statusSource": "delivery-record-present",
            "doc": str(sales_order) if sales_order is not None else "",
        })

    countries = [
        {
            "code": c["code"],
            "name": c["name"],
            "qty": float(c["qty"]),
            "pct": float(c["qty"]) / total_qty if total_qty > 0 else 0.0,
        }
        for c in sorted(country_totals.values(), key=lambda x: -float(x["qty"]))
    ]

    result: dict = {
        "totals": {
            "customers": len(customers),
            "countries": len(country_totals),
            "deliveries": len(deliveries),
            "shipped": total_qty,
            "uom": uom or "",
        },
        "countries": countries,
        "deliveries": deliveries,
        # Recall recommendation is a governance decision and is not yet
        # computed server-side. The only safe value is `not-evaluated`.
        # The UI MUST NOT interpret this as "no recall needed".
        "recommendationStatus": "not-evaluated",
    }
    return result


# ---------------------------------------------------------------------------
# Trace App slice — getSupplierBatches  (gold_batch_lineage two-step walk)
# ---------------------------------------------------------------------------

def get_supplier_consumed_lots_spec(request: Trace2SupplierBatchViewRequest) -> QuerySpec:
    """Return a QuerySpec for the consumed-lots half of the Supplier Batches tab.

    Source: gold_batch_lineage filtered to LINK_TYPE='VENDOR_RECEIPT' edges where
    the CHILD is the active batch. SUPPLIER_ID identifies the vendor;
    PARENT_BATCH_ID is the vendor batch.

    Single-hop only — multi-hop upstream walk is out of scope here.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_lineage")

    sql = f"""
    SELECT
      SUPPLIER_ID            AS supplier_id,
      PARENT_BATCH_ID        AS vendor_batch,
      PARENT_MATERIAL_ID     AS parent_material_id,
      QUANTITY               AS quantity,
      BASE_UNIT_OF_MEASURE   AS uom,
      POSTING_DATE           AS posting_date
    FROM {tbl}
    WHERE CHILD_MATERIAL_ID = :material_id
      AND CHILD_BATCH_ID   = :batch_id
      AND LINK_TYPE        = 'VENDOR_RECEIPT'
      AND SUPPLIER_ID IS NOT NULL
      AND PARENT_BATCH_ID IS NOT NULL
    ORDER BY POSTING_DATE DESC
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_supplier_consumed_lots",
        module="trace2",
        endpoint="/api/trace2/supplier-batches",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_lineage",
        tags=["trace2", "trace-app", "supplier-batches", "consumed-lots"],
    )


def get_supplier_sibling_batches_spec(
    request: Trace2SupplierBatchViewRequest,
    vendor_batches: list[str],
) -> QuerySpec:
    """Sibling batches: other batches across plants that consumed any of the
    vendor lots this batch consumed.

    Source: gold_batch_lineage with LINK_TYPE='VENDOR_RECEIPT', joined back on
    PARENT_BATCH_ID IN (vendor_batches we found). Plant filter is intentionally
    omitted — the whole point is to surface cross-plant ripple risk.

    If `vendor_batches` is empty, returns a no-op spec that selects nothing.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_lineage")

    if not vendor_batches:
        # Empty filter — produce a guaranteed-zero-row query without parameter binding for IN clause.
        sql = "SELECT NULL AS plant_id, NULL AS batch_id, NULL AS mfg, NULL AS qty, NULL AS vendor_batch WHERE 1 = 0"
        return QuerySpec(
            name="trace2.get_supplier_sibling_batches",
            module="trace2",
            endpoint="/api/trace2/supplier-batches",
            sql=sql,
            params={},
            cache_policy=CacheTier.PER_USER_60S,
            source_badge="view:gold_batch_lineage",
            tags=["trace2", "trace-app", "supplier-batches", "siblings-empty"],
        )

    # Embed the vendor_batch list as literal strings (already validated upstream
    # by SQL identifier policy in the parameter binding layer); fall back to
    # quoting defensively here.
    sanitised = [vb.replace("'", "''") for vb in vendor_batches]
    in_list = ", ".join(f"'{vb}'" for vb in sanitised)

    sql = f"""
    SELECT
      CHILD_PLANT_ID        AS plant_id,
      CHILD_BATCH_ID        AS batch_id,
      CHILD_MATERIAL_ID     AS child_material_id,
      POSTING_DATE          AS posting_date,
      QUANTITY              AS quantity,
      BASE_UNIT_OF_MEASURE  AS uom,
      PARENT_BATCH_ID       AS vendor_batch
    FROM {tbl}
    WHERE LINK_TYPE = 'VENDOR_RECEIPT'
      AND PARENT_BATCH_ID IN ({in_list})
      AND NOT (CHILD_MATERIAL_ID = :material_id AND CHILD_BATCH_ID = :batch_id)
      AND CHILD_BATCH_ID IS NOT NULL
    ORDER BY POSTING_DATE DESC
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_supplier_sibling_batches",
        module="trace2",
        endpoint="/api/trace2/supplier-batches",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_lineage",
        tags=["trace2", "trace-app", "supplier-batches", "siblings"],
    )


def map_supplier_batch_view(
    consumed_rows: list[dict],
    sibling_rows: list[dict],
    vendor_name_lookup: Optional[dict[str, str]] = None,
) -> dict:
    """Combine consumed-lot rows and sibling rows into SupplierBatchView shape.

    Always returns a dict — empty consumed/siblings lists are valid (a batch may
    have no recorded vendor receipts in the lineage view).
    Vendor names default to the supplier ID if `vendor_name_lookup` is empty —
    gold_supplier join is omitted in this slice to keep the query lean. Replace
    when vendor masters are wired.
    """
    consumed_lots: list[dict] = []
    for row in consumed_rows:
        supplier_id = str(row.get("supplier_id") or "")
        vendor_name = (vendor_name_lookup or {}).get(supplier_id, supplier_id)
        consumed_lots.append({
            "vendor": vendor_name,
            "vendorBatch": str(row.get("vendor_batch") or ""),
            "material": str(row.get("parent_material_id") or ""),
            "receipt": str(row.get("posting_date") or ""),
            "consumed": abs(float(row.get("quantity") or 0)),
            "uom": str(row.get("uom") or ""),
            # CoA reference is not on gold_batch_lineage — left null.
            "coa": None,
            # Risk is server-derived from supplier history once that view exists.
            "risk": "unknown",
        })

    sibling_batches: list[dict] = []
    for row in sibling_rows:
        plant_id = str(row.get("plant_id") or "")
        sibling_batches.append({
            "plant": plant_id,
            "plantId": plant_id or None,
            "batchId": str(row.get("batch_id") or ""),
            "mfg": str(row.get("posting_date") or ""),
            "qty": abs(float(row.get("quantity") or 0)),
            "vendorBatch": str(row.get("vendor_batch") or ""),
        })

    return {
        "consumedLots": consumed_lots,
        "siblingBatches": sibling_batches,
    }


# ---------------------------------------------------------------------------
# Trace App slice — getBatchQualityPassport (partial: identity + stock + production)
# ---------------------------------------------------------------------------
#
# The Quality Passport response has 7 sections (identity, quality, stock,
# production, lotHistory, massBalance, signoff). This slice covers the three
# that can be sourced from already-verified gold views. The remaining four
# (quality.coa, lotHistory, massBalance variance/note, signoff) and the
# confidence score require future sources and stay mock-only.
#
# A frontend integration that wants partial real data can call this endpoint
# for identity/stock/production and merge with the existing mock for the rest.

def get_batch_quality_passport_partial_spec(request: Trace2BatchQualityPassportRequest) -> QuerySpec:
    """Return a QuerySpec for the verified-source portion of the Quality Passport.

    Sources (all verified live in connected_plant_uat.gold via the 2026-05-25
    Databricks repository compatibility audit — see
    docs/data-layer/trace2-batch-quality-passport-source-verification.md):
      - gold_batch_stock_v               → stock buckets (per plant)
      - gold_batch_summary_v             → manufacture / expiry dates only
      - gold_material                    → material description, base UoM
      - gold_plant                       → plant name
      - gold_batch_production_history_v  → process order, posting date,
                                            batch quantity, UoM

    Removed projections (columns absent from live DDL — caused
    UNRESOLVED_COLUMN before this fix):
      - b.PROCESS_ORDER_ID (gold_batch_summary_v has only MATERIAL_ID,
        BATCH_ID, MANUFACTURE_DATE, SHELF_LIFE_EXPIRATION_DATE,
        MATERIAL_NAME, MATERIAL_TYPE, MATERIAL_DESC_SHORT, days_to_expiry,
        shelf_life_status)
      - ph.START_DATE, ph.CONFIRMED_DATE, ph.PLANNED_QTY, ph.ACTUAL_QTY,
        ph.PRODUCTION_LINE, ph.OPERATOR (gold_batch_production_history_v
        has only PROCESS_ORDER_ID, BATCH_ID, PLANT_ID, MATERIAL_ID,
        POSTING_DATE, BATCH_QTY, UOM, quality_status)

    Mapping decisions:
      - process_order_id now comes from gold_batch_production_history_v
        (PROCESS_ORDER_ID), not gold_batch_summary_v.
      - production_started_at maps from POSTING_DATE. This is the
        production-history posting date and is NOT claimed to be the
        confirmed production start timestamp — the live view exposes no
        START / CONFIRMED timestamps.
      - production_actual_qty maps from BATCH_QTY. This is the actual
        batch quantity recorded on the production-history posting, NOT a
        planned quantity — the live view exposes no planned-vs-actual split.
      - production_uom is selected as ph.UOM but is currently not surfaced
        through the Production contract (which has no production-uom
        field); the row key is kept so a future contract addition can
        consume it without re-touching the SQL.

    Intentionally unavailable (no live source column — the mapper emits
    contract defaults to keep the response body shape stable):
      - production_confirmed_at
      - production_planned_qty
      - production_line
      - production_operator

    Plant filter is respected when supplied — leave plant_id='' to take the
    first row by sort order (consistent with the existing batch-header route).
    """
    tbl_stock = resolve_domain_object("trace2", "gold_batch_stock_v")
    tbl_summary = resolve_domain_object("trace2", "gold_batch_summary_v")
    tbl_material = resolve_domain_object("trace2", "gold_material")
    tbl_plant = resolve_domain_object("trace2", "gold_plant")
    tbl_prod = resolve_domain_object("trace2", "gold_batch_production_history_v")

    sql = f"""
    SELECT
        s.MATERIAL_ID                AS material_id,
        s.BATCH_ID                   AS batch_id,
        s.PLANT_ID                   AS plant_id,
        s.unrestricted,
        s.blocked,
        s.quality_inspection,
        s.restricted,
        s.transit,
        s.total_stock,
        m.MATERIAL_NAME              AS material_name,
        m.BASE_UNIT_OF_MEASURE       AS uom,
        p.PLANT_NAME                 AS plant_name,
        b.MANUFACTURE_DATE           AS manufacture_date,
        b.SHELF_LIFE_EXPIRATION_DATE AS expiry_date,
        ph.PROCESS_ORDER_ID          AS process_order_id,
        ph.POSTING_DATE              AS production_started_at,
        ph.BATCH_QTY                 AS production_actual_qty,
        ph.UOM                       AS production_uom
    FROM {tbl_stock} s
    JOIN {tbl_summary} b
        ON s.MATERIAL_ID = b.MATERIAL_ID AND s.BATCH_ID = b.BATCH_ID
    JOIN {tbl_material} m
        ON s.MATERIAL_ID = m.MATERIAL_ID AND m.LANGUAGE_ID = 'E'
    JOIN {tbl_plant} p
        ON s.PLANT_ID = p.PLANT_ID
    LEFT JOIN {tbl_prod} ph
        ON s.MATERIAL_ID = ph.MATERIAL_ID AND s.BATCH_ID = ph.BATCH_ID
    WHERE s.MATERIAL_ID = :material_id
      AND s.BATCH_ID   = :batch_id
      AND (:plant_id = '' OR s.PLANT_ID = :plant_id)
    ORDER BY s.PLANT_ID
    LIMIT 1
    """

    return QuerySpec(
        name="trace2.get_batch_quality_passport_partial",
        module="trace2",
        endpoint="/api/trace2/batch-quality-passport",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_stock_v+summary_v+production_history_v",
        tags=["trace2", "trace-app", "quality-passport", "partial"],
    )


def map_batch_quality_passport_partial(rows: list[dict]) -> Optional[dict]:
    """Map the partial passport join result to the identity + stock + production
    sections of BatchQualityPassportSchema. The quality, lotHistory,
    massBalance, and signoff fields are NOT populated — frontend must merge
    with mock or a future hook that resolves those.

    Returns None on zero rows so the route can 404 (same convention as the
    existing batch-header route).

    Production-section source mapping (2026-05-25 Databricks compatibility
    audit, Finding #2 — see
    docs/data-layer/trace2-batch-quality-passport-source-verification.md):

      Sourced from live ``gold_batch_production_history_v``:
        - ``orderId``   ← ``process_order_id`` (PROCESS_ORDER_ID)
        - ``startedAt`` ← ``production_started_at`` (POSTING_DATE — the
          production-posting date, **not** a confirmed production start
          timestamp; the live view has no START / CONFIRMED columns)
        - ``actualQty`` ← ``production_actual_qty`` (BATCH_QTY — the
          actual batch quantity, **not** a planned quantity)

      Intentionally unavailable from the live view (the live DDL has no
      START_DATE / CONFIRMED_DATE / PLANNED_QTY / ACTUAL_QTY /
      PRODUCTION_LINE / OPERATOR columns). The mapper emits the contract
      defaults below to satisfy the required-string / required-float
      ``Production`` model; relaxing those fields to nullable is a
      follow-up tracked in the source-verification doc:
        - ``line``         → "" (Production.line is required str)
        - ``operator``     → "" (Production.operator is required str)
        - ``confirmedAt``  → "" (Production.confirmed_at is required str)
        - ``plannedQty``   → 0.0 (Production.planned_qty is required float)
        - ``yield``        → 0.0 (no planned/actual split is available;
          source-verification doc §4 flags this as application-derived
          and currently null-equivalent)
    """
    if not rows:
        return None
    row = rows[0]

    # Days-to-expiry — defer to caller / frontend (relies on "today" context).
    return {
        "identity": {
            "materialDescription": str(row.get("material_name") or ""),
            "materialId": str(row.get("material_id") or ""),
            "batchId": str(row.get("batch_id") or ""),
            "plantName": str(row.get("plant_name") or ""),
            "plantId": str(row.get("plant_id") or ""),
            "processOrderId": str(row.get("process_order_id") or ""),
            "manufactureDate": str(row.get("manufacture_date") or ""),
            "expiryDate": str(row.get("expiry_date") or ""),
            "daysToExpiry": 0,  # frontend recomputes from expiryDate
            "uom": str(row.get("uom") or ""),
        },
        "stock": {
            "unrestricted": float(row.get("unrestricted") or 0),
            "qualityInspection": float(row.get("quality_inspection") or 0),
            "blocked": float(row.get("blocked") or 0),
            "restricted": float(row.get("restricted") or 0),
            "transit": float(row.get("transit") or 0),
            "uom": str(row.get("uom") or ""),
        },
        "production": {
            "orderId": str(row.get("process_order_id") or ""),
            # No PRODUCTION_LINE column in gold_batch_production_history_v.
            "line": str(row.get("production_line") or ""),
            # No OPERATOR column in gold_batch_production_history_v.
            "operator": str(row.get("production_operator") or ""),
            # POSTING_DATE — the production-posting date, not a confirmed
            # start timestamp.
            "startedAt": str(row.get("production_started_at") or ""),
            # No CONFIRMED_DATE column — contract default keeps the
            # response body shape stable.
            "confirmedAt": str(row.get("production_confirmed_at") or ""),
            # No PLANNED_QTY column — contract default keeps the response
            # body shape stable.
            "plannedQty": float(row.get("production_planned_qty") or 0),
            # BATCH_QTY — the actual batch quantity recorded on the
            # production-history posting.
            "actualQty": float(row.get("production_actual_qty") or 0),
            "yield": (
                float(row.get("production_actual_qty") or 0)
                / float(row.get("production_planned_qty") or 1)
                if float(row.get("production_planned_qty") or 0) > 0
                else 0.0
            ),
            "originatingCustomer": "",  # not in gold_batch_production_history_v
            "notes": "",  # not in gold_batch_production_history_v
        },
        # "production" was added 2026-05-25 because the post-audit SQL only
        # surfaces orderId / startedAt / actualQty from the live view; the
        # other Production fields stay contract-defaulted (see docstring).
        "_unverifiedSections": [
            "quality",
            "lotHistory",
            "massBalance",
            "signoff",
            "production",
        ],
    }


# ---------------------------------------------------------------------------
# Trace App slice — getMassBalanceLedger  (gold_batch_mass_balance_v)
# ---------------------------------------------------------------------------
#
# Source columns verified live: MATERIAL_ID, BATCH_ID, PLANT_ID, PROCESS_ORDER_ID,
# MOVEMENT_CATEGORY, MOVEMENT_TYPE, QUANTITY (signed), ABS_QUANTITY, BALANCE_QTY,
# UOM, POSTING_DATE.

# Map common MSEG movement types to the panel's bucket codes. The panel
# accepts {101, 261, 601, 701, Z01}; everything else is bucketed as 'Z01'.
_MASS_BALANCE_CODE_MAP: dict[str, str] = {
    "101": "101",  # Goods receipt for purchase order / production order
    "102": "101",  # Reversal of 101 — keep in production bucket so net is correct
    "131": "101",  # Goods receipt from production
    "261": "261",  # Goods issue to order
    "262": "261",  # Reversal of 261
    "601": "601",  # Goods issue · delivery
    "602": "601",  # Reversal of 601
    "701": "701",  # Inventory adjustment
    "702": "701",
    "711": "701",
    "712": "701",
}


def _bucket_movement_type(mvt: Optional[str]) -> str:
    if mvt is None:
        return "Z01"
    return _MASS_BALANCE_CODE_MAP.get(str(mvt).strip(), "Z01")


def _movement_label(mvt: Optional[str], category: Optional[str]) -> str:
    cat = str(category or "").strip().lower()
    code = str(mvt or "").strip()
    if cat:
        return f"{cat.capitalize()} · {code}" if code else cat.capitalize()
    return f"Movement {code}" if code else "Movement"


def get_mass_balance_ledger_spec(request: Trace2MassBalanceLedgerRequest) -> QuerySpec:
    """Return a QuerySpec for the Trace App Mass Balance tab.

    Source: gold_batch_mass_balance_v ordered by POSTING_DATE so the panel
    receives events in chronological order. The mapper computes KPIs by
    bucketing MOVEMENT_TYPE into the panel's {101, 261, 601, 701, Z01} codes
    and aggregates signed QUANTITY values per bucket.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_mass_balance_v")

    sql = f"""
    SELECT
      POSTING_DATE        AS posting_date,
      MOVEMENT_TYPE       AS movement_type,
      MOVEMENT_CATEGORY   AS movement_category,
      QUANTITY            AS quantity,
      ABS_QUANTITY        AS abs_quantity,
      BALANCE_QTY         AS balance_qty,
      UOM                 AS uom,
      PROCESS_ORDER_ID    AS process_order_id
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
      AND (:plant_id = '' OR PLANT_ID = :plant_id)
    ORDER BY POSTING_DATE, MOVEMENT_TYPE
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_mass_balance_ledger",
        module="trace2",
        endpoint="/api/trace2/mass-balance-ledger",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_mass_balance_v",
        tags=["trace2", "trace-app", "mass-balance-ledger"],
    )


def map_mass_balance_ledger_rows(rows: list[dict]) -> Optional[dict]:
    """Map gold_batch_mass_balance_v rows to MassBalanceLedgerSchema shape.

    Zero rows → returns None. Variance is computed from the bucket aggregates:
      variance = produced + adjusted + consumed + shipped - current
    Negative consumption/shipping values keep their natural signs.
    """
    if not rows:
        return None

    events: list[dict] = []
    # uom is source-truthful: stays `None` when no row provides one.
    # Contract was relaxed to z.string().nullable() so we no longer emit
    # the empty-string sentinel (which read as "unit is empty" rather
    # than "unit is unavailable"). See PR brief Part B.
    uom: Optional[str] = None
    cum_running = 0.0
    for i, row in enumerate(rows):
        bucket = _bucket_movement_type(row.get("movement_type"))
        qty = float(row.get("quantity") or 0)
        balance = row.get("balance_qty")
        cum_running = float(balance) if balance is not None else cum_running + qty
        if uom is None and row.get("uom") is not None:
            raw_uom = str(row["uom"]).strip()
            if raw_uom:
                uom = raw_uom
        events.append({
            "d": i,
            "date": str(row.get("posting_date") or ""),
            "delta": round(qty * 10) / 10,
            "cum": round(cum_running * 10) / 10,
            "code": bucket,
            "label": _movement_label(row.get("movement_type"), row.get("movement_category")),
        })

    def _sum_where(code: str) -> float:
        return sum(e["delta"] for e in events if e["code"] == code)

    def _count_where(code: str) -> int:
        return sum(1 for e in events if e["code"] == code)

    produced = _sum_where("101")
    consumed = _sum_where("261")
    shipped = _sum_where("601")
    adjusted = _sum_where("701")
    current = events[-1]["cum"] if events else 0.0
    variance = round((produced + adjusted + consumed + shipped - current) * 10) / 10

    date_start = events[0]["date"] if events else ""
    date_end = events[-1]["date"] if events else ""

    return {
        "kpi": {
            "produced": round(produced),
            "consumed": round(consumed),
            "shipped": round(shipped),
            "adjusted": round(adjusted),
            "current": round(current),
            "variance": variance,
            "uom": uom,
            "postings": {
                "production": _count_where("101"),
                "consumption": _count_where("261"),
                "dispatch": _count_where("601"),
                "adjustment": _count_where("701"),
            },
        },
        "events": events,
        "dateStart": date_start,
        "dateEnd": date_end,
        # Reconciliation is application-derived (variance formula above).
        # MOVEMENT_CATEGORY direction and BALANCE_QTY semantics are not yet
        # governed — UI must surface this caveat.
        "reconciliationSource": "application-heuristic",
    }


# ---------------------------------------------------------------------------
# Trace App slice — getInvestigationTimeline (UNION over 3 sources)
# ---------------------------------------------------------------------------

def get_investigation_timeline_spec(request: Trace2InvestigationTimelineRequest) -> QuerySpec:
    """UNION timeline events from mass-balance, quality-lot, and delivery sources.

    No dedicated `gold_investigation_events` view yet — this synthesises a
    chronological feed from existing verified sources:
      - gold_batch_mass_balance_v → production / consumption / dispatch
      - gold_batch_quality_lot_v  → QC inspections, lot decisions
      - gold_batch_delivery_v     → customer dispatch (cross-plant)

    Each branch tags `event_type`, `tone`, and `source_system` so the mapper
    can produce one homogeneous list. POSTING_DATE / INSPECTION_END_DATE drive
    chronology.
    """
    tbl_mb = resolve_domain_object("trace2", "gold_batch_mass_balance_v")
    tbl_ql = resolve_domain_object("trace2", "gold_batch_quality_lot_v")
    tbl_dl = resolve_domain_object("trace2", "gold_batch_delivery_v")

    sql = f"""
    SELECT * FROM (
      SELECT
        CAST(POSTING_DATE AS STRING) AS ts,
        CASE
          WHEN MOVEMENT_TYPE IN ('101','102','131') THEN 'production'
          WHEN MOVEMENT_TYPE IN ('261','262')        THEN 'consumption'
          WHEN MOVEMENT_TYPE IN ('601','602')        THEN 'dispatch'
          ELSE 'note'
        END                                          AS event_type,
        CONCAT('Movement ', COALESCE(MOVEMENT_TYPE, '?'),
               ' · ', COALESCE(MOVEMENT_CATEGORY, ''))  AS label,
        'SAP · auto'                                 AS actor,
        CONCAT(CAST(ROUND(QUANTITY, 1) AS STRING), ' ', COALESCE(UOM, '')) AS detail,
        CASE
          WHEN QUANTITY > 0 THEN 'good'
          WHEN QUANTITY < 0 THEN 'neutral'
          ELSE 'neutral'
        END                                          AS tone,
        'SAP'                                        AS source_system
      FROM {tbl_mb}
      WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
        AND (:plant_id = '' OR PLANT_ID = :plant_id)

      UNION ALL

      SELECT
        CAST(COALESCE(INSPECTION_END_DATE, CREATED_DATE) AS STRING) AS ts,
        'qc'                                         AS event_type,
        CONCAT('Inspection ', COALESCE(INSPECTION_LOT_ID, '?'),
               ' · ', COALESCE(INSPECTION_TYPE, ''))  AS label,
        COALESCE(CREATED_BY, 'Lab · auto')           AS actor,
        COALESCE(USAGE_DECISION_LONG_TEXT,
                 INSPECTION_SHORT_TEXT, '')          AS detail,
        'good'                                       AS tone,
        'LIMS'                                       AS source_system
      FROM {tbl_ql}
      WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
        AND (:plant_id = '' OR PLANT_ID = :plant_id)

      UNION ALL

      SELECT
        CAST(POSTING_DATE AS STRING)                 AS ts,
        'dispatch'                                   AS event_type,
        CONCAT('Delivery ', COALESCE(DELIVERY, '?'),
               ' · ', COALESCE(COUNTRY_ID, ''))      AS label,
        'SAP · auto'                                 AS actor,
        CONCAT(CAST(ROUND(ABS_QUANTITY, 1) AS STRING), ' ', COALESCE(UOM, ''),
               ' → ', COALESCE(CUSTOMER_NAME, ''))   AS detail,
        'brand'                                      AS tone,
        'SAP'                                        AS source_system
      FROM {tbl_dl}
      WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
        AND DELIVERY IS NOT NULL
    )
    ORDER BY ts
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_investigation_timeline",
        module="trace2",
        endpoint="/api/trace2/investigation-timeline",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="union:mass_balance_v+quality_lot_v+delivery_v",
        tags=["trace2", "trace-app", "investigation-timeline"],
    )


_TIMELINE_TONE_MAP = {"good", "warn", "bad", "brand", "neutral"}
_TIMELINE_TYPE_MAP = {"production", "consumption", "qc", "release", "approval", "hold", "dispatch", "note"}
_TIMELINE_SOURCE_MAP = {"SAP", "LIMS", "TRACE", "MANUAL"}


def map_investigation_timeline_rows(rows: list[dict]) -> dict:
    """Coerce the UNION rows into TimelineEvent[] shape.

    Returns an empty `events` array (not 404) when no rows match — an empty
    timeline is a valid state (the batch may simply not have had any
    inspections or dispatches yet).
    """
    events: list[dict] = []
    for row in rows:
        ev_type = str(row.get("event_type") or "note")
        if ev_type not in _TIMELINE_TYPE_MAP:
            ev_type = "note"
        tone = str(row.get("tone") or "neutral")
        if tone not in _TIMELINE_TONE_MAP:
            tone = "neutral"
        source = row.get("source_system")
        if source is not None and source not in _TIMELINE_SOURCE_MAP:
            source = None
        events.append({
            "ts": str(row.get("ts") or ""),
            "type": ev_type,
            "label": str(row.get("label") or "").strip() or "Event",
            "actor": str(row.get("actor") or "").strip() or "—",
            "detail": str(row.get("detail") or "").strip(),
            "tone": tone,
            "sourceSystem": source,
        })
    return {"events": events}


# ---------------------------------------------------------------------------
# Trace App slice — getHoldsLedger  (gold_batch_stock_v + gold_batch_quality_lot_v)
# ---------------------------------------------------------------------------

def get_holds_ledger_spec(request: Trace2HoldsLedgerRequest) -> QuerySpec:
    """Holds ledger derived from current stock buckets + quality lot decisions.

    No dedicated `gold_holds_ledger` view yet. This slice synthesises:
      - qtyByReason from gold_batch_stock_v.{blocked, restricted, quality_inspection}
      - active / resolved holds from gold_batch_quality_lot_v entries with no
        usage decision (active) vs. those with a decision (resolved).

    Single-row join strategy — stock columns come from one stock_v row;
    identity comes from either base or stock depending on which source is
    populated. Quality lots are returned in a subselect.
    """
    tbl_stock = resolve_domain_object("trace2", "gold_batch_stock_v")
    tbl_ql = resolve_domain_object("trace2", "gold_batch_quality_lot_v")

    sql = f"""
    SELECT
      s.unrestricted,
      s.blocked,
      s.quality_inspection,
      s.restricted,
      s.transit,
      ql.INSPECTION_LOT_ID  AS inspection_lot_id,
      ql.INSPECTION_TYPE    AS inspection_type,
      ql.INSPECTION_SHORT_TEXT AS inspection_short_text,
      ql.CREATED_DATE       AS created_date,
      ql.INSPECTION_END_DATE AS inspection_end_date,
      ql.CREATED_BY         AS created_by,
      ql.USAGE_DECISION_LONG_TEXT AS usage_decision
    FROM {tbl_stock} s
    LEFT JOIN {tbl_ql} ql
      ON s.MATERIAL_ID = ql.MATERIAL_ID AND s.BATCH_ID = ql.BATCH_ID
    WHERE s.MATERIAL_ID = :material_id
      AND s.BATCH_ID   = :batch_id
      AND (:plant_id = '' OR s.PLANT_ID = :plant_id)
    ORDER BY ql.CREATED_DATE DESC
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_holds_ledger",
        module="trace2",
        endpoint="/api/trace2/holds-ledger",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_stock_v+quality_lot_v",
        tags=["trace2", "trace-app", "holds-ledger"],
    )


def map_holds_ledger_rows(rows: list[dict]) -> Optional[dict]:
    """Build a HoldsLedger shape from the stock+quality_lot LEFT JOIN.

    The stock buckets are the same across rows (one stock row per batch+plant)
    so we read them from the first row. Quality lots vary per row; we split
    them into active (no usage decision) and resolved (has decision) lists.
    """
    if not rows:
        return None
    first = rows[0]
    # gold_batch_stock_v does not expose a UOM column for this view. The
    # contract has `uom: string | null` — do NOT default to "KG". Future
    # revision: join to gold_material.BASE_UNIT_OF_MEASURE.
    uom: Optional[str] = None

    qty_by_reason: list[dict] = []
    blocked = float(first.get("blocked") or 0)
    restricted = float(first.get("restricted") or 0)
    qi = float(first.get("quality_inspection") or 0)
    if blocked > 0:
        qty_by_reason.append({
            "code": "B3", "label": "Blocked stock", "qty": blocked,
            "uom": uom, "color": "var(--sunset, #F24A00)",
        })
    if qi > 0:
        qty_by_reason.append({
            "code": "Q4", "label": "Quality inspection", "qty": qi,
            "uom": uom, "color": "var(--sage, #289BA2)",
        })
    if restricted > 0:
        qty_by_reason.append({
            "code": "R1", "label": "Restricted", "qty": restricted,
            "uom": uom, "color": "var(--sunrise, #F9C20A)",
        })

    active: list[dict] = []
    resolved: list[dict] = []
    seen_lots: set[str] = set()
    for row in rows:
        lot_id = row.get("inspection_lot_id")
        if not lot_id:
            continue
        lot_id_str = str(lot_id)
        if lot_id_str in seen_lots:
            continue
        seen_lots.add(lot_id_str)
        usage_decision = row.get("usage_decision")
        end_date = row.get("inspection_end_date")
        created_date = row.get("created_date")
        inspector = str(row.get("created_by") or "—")
        short_text = str(row.get("inspection_short_text") or row.get("inspection_type") or "Inspection")

        entry = {
            "id": lot_id_str,
            "reason": f"QC · {short_text}",
            "reasonCode": "QC",
            "qty": qi if qi > 0 else 0.0,
            "uom": uom,
            "opened": str(created_date or "").split("T")[0] if created_date else "",
            "owner": inspector,
            "detail": short_text,
        }

        if usage_decision:
            entry["status"] = "released" if "accept" in str(usage_decision).lower() else "rejected"
            entry["resolved"] = str(end_date or "").split("T")[0] if end_date else ""
            entry["resolution"] = str(usage_decision)
            resolved.append(entry)
        else:
            entry["status"] = "pending"
            active.append(entry)

    return {
        "activeHolds": active,
        "resolvedHolds": resolved,
        "qtyByReason": qty_by_reason,
    }


# ---------------------------------------------------------------------------
# Trace App slice — getBatchQualityPassport (FULL — replaces partial above)
# ---------------------------------------------------------------------------

def get_batch_quality_passport_coa_spec(request: Trace2BatchQualityPassportRequest) -> QuerySpec:
    """Fetch CoA characteristic results for the active batch.

    Source: gold_batch_quality_result_v.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_quality_result_v")
    sql = f"""
    SELECT
      MIC_ID                       AS mic,
      MIC_NAME                     AS param,
      LOWER_TOLERANCE              AS low,
      UPPER_TOLERANCE              AS high,
      TARGET_VALUE                 AS target,
      QUANTITATIVE_RESULT          AS actual_qty,
      QUALITATIVE_RESULT           AS actual_qual,
      UNIT_OF_MEASURE              AS uom,
      INSPECTION_RESULT_VALUATION  AS valuation
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
      AND (:plant_id = '' OR PLANT_ID = :plant_id)
    ORDER BY MIC_ID
    LIMIT 100
    """
    return QuerySpec(
        name="trace2.get_passport_coa",
        module="trace2",
        endpoint="/api/trace2/batch-quality-passport",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_quality_result_v",
        tags=["trace2", "trace-app", "quality-passport", "coa"],
    )


def get_batch_quality_passport_lots_spec(request: Trace2BatchQualityPassportRequest) -> QuerySpec:
    """Fetch lot history (recent inspections) for the active batch."""
    tbl = resolve_domain_object("trace2", "gold_batch_quality_lot_v")
    sql = f"""
    SELECT
      INSPECTION_LOT_ID           AS id,
      COALESCE(INSPECTION_END_DATE, CREATED_DATE) AS date,
      INSPECTION_TYPE             AS inspection,
      USAGE_DECISION_LONG_TEXT    AS usage_decision,
      CREATED_BY                  AS decision_by
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
      AND (:plant_id = '' OR PLANT_ID = :plant_id)
    ORDER BY COALESCE(INSPECTION_END_DATE, CREATED_DATE) DESC
    LIMIT 20
    """
    return QuerySpec(
        name="trace2.get_passport_lots",
        module="trace2",
        endpoint="/api/trace2/batch-quality-passport",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_quality_lot_v",
        tags=["trace2", "trace-app", "quality-passport", "lots"],
    )


def get_batch_quality_passport_summary_spec(request: Trace2BatchQualityPassportRequest) -> QuerySpec:
    """Fetch quality KPI counts from gold_batch_quality_summary_v."""
    tbl = resolve_domain_object("trace2", "gold_batch_quality_summary_v")
    sql = f"""
    SELECT lot_count, failed_mic_count, accepted_result_count, rejected_result_count, latest_inspection_date
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
    LIMIT 1
    """
    return QuerySpec(
        name="trace2.get_passport_summary",
        module="trace2",
        endpoint="/api/trace2/batch-quality-passport",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_quality_summary_v",
        tags=["trace2", "trace-app", "quality-passport", "summary"],
    )


def get_batch_quality_passport_balance_spec(request: Trace2BatchQualityPassportRequest) -> QuerySpec:
    """Fetch the latest BALANCE_QTY and the net produced-vs-current variance."""
    tbl = resolve_domain_object("trace2", "gold_batch_mass_balance_v")
    sql = f"""
    SELECT
      SUM(CASE WHEN MOVEMENT_TYPE IN ('101','102','131') THEN QUANTITY ELSE 0 END)  AS produced,
      SUM(CASE WHEN MOVEMENT_TYPE IN ('261','262')        THEN QUANTITY ELSE 0 END)  AS consumed,
      SUM(CASE WHEN MOVEMENT_TYPE IN ('601','602')        THEN QUANTITY ELSE 0 END)  AS shipped,
      SUM(CASE WHEN MOVEMENT_TYPE IN ('701','702','711','712') THEN QUANTITY ELSE 0 END) AS adjusted,
      MAX_BY(BALANCE_QTY, POSTING_DATE)  AS latest_balance,
      MAX(UOM)                            AS uom
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
      AND (:plant_id = '' OR PLANT_ID = :plant_id)
    """
    return QuerySpec(
        name="trace2.get_passport_balance",
        module="trace2",
        endpoint="/api/trace2/batch-quality-passport",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_mass_balance_v",
        tags=["trace2", "trace-app", "quality-passport", "balance"],
    )


def _classify_coa_status(
    valuation: Optional[str],
    actual: Optional[float],
    low: Optional[float],
    high: Optional[float],
) -> str:
    """Return 'ok' / 'warn' / 'fail' for a CoA row.

    Uses SAP INSPECTION_RESULT_VALUATION when present (A=accepted, R=rejected),
    falls back to numeric tolerance comparison.
    """
    v = (str(valuation or "")).strip().upper()
    if v in ("R", "REJECTED", "FAIL"):
        return "fail"
    if v in ("A", "ACCEPTED", "OK"):
        # check warn band: within 10% of upper or lower tolerance
        if actual is not None and low is not None and high is not None and high > low:
            margin = (high - low) * 0.1
            if actual > high - margin or actual < low + margin:
                return "warn"
        return "ok"
    # No explicit valuation — use tolerance window
    if actual is None or low is None or high is None:
        return "ok"
    if actual < low or actual > high:
        return "fail"
    margin = (high - low) * 0.1 if high > low else 0
    if margin > 0 and (actual > high - margin or actual < low + margin):
        return "warn"
    return "ok"


def build_batch_quality_passport(
    identity_rows: list[dict],
    coa_rows: list[dict],
    lot_rows: list[dict],
    summary_rows: list[dict],
    balance_rows: list[dict],
) -> Optional[dict]:
    """Assemble a full BatchQualityPassport response from 5 source queries.

    Returns None if identity_rows is empty (no batch found in primary sources).
    Empty coa/lot/balance lists are valid — corresponding sections render with
    empty or zero state.
    """
    partial = map_batch_quality_passport_partial(identity_rows)
    if partial is None:
        return None

    # CoA
    coa: list[dict] = []
    failed = 0
    warn = 0
    for r in coa_rows:
        actual_qty = r.get("actual_qty")
        actual_qual = r.get("actual_qual")
        binary_value = str(actual_qual).strip() if actual_qual is not None else None
        low = float(r.get("low") or 0)
        high = float(r.get("high") or 0)
        target = float(r.get("target") or 0)
        actual = float(actual_qty) if actual_qty is not None else 0.0
        status = _classify_coa_status(r.get("valuation"), actual if actual_qty is not None else None, low, high)
        if status == "fail":
            failed += 1
        elif status == "warn":
            warn += 1
        entry: dict = {
            "mic": str(r.get("mic") or ""),
            "param": str(r.get("param") or ""),
            "low": low,
            "high": high,
            "target": target,
            "actual": actual,
            "uom": str(r.get("uom") or ""),
            "status": status,
        }
        if binary_value and (actual_qty is None or low == 0 == high):
            entry["binary"] = binary_value
        coa.append(entry)

    # Quality summary KPIs
    s = summary_rows[0] if summary_rows else {}
    lot_count = int(s.get("lot_count") or len(lot_rows) or 0)
    accepted_results = int(s.get("accepted_result_count") or 0)
    rejected_results = int(s.get("rejected_result_count") or 0)
    failed_mics = int(s.get("failed_mic_count") or failed)

    # Confidence — simple heuristic from available signals
    confidence = 100
    notes: list[str] = []
    if failed_mics > 0:
        confidence -= 20 * failed_mics
        notes.append(f"{failed_mics} failed MIC{'s' if failed_mics != 1 else ''}")
    if rejected_results > 0:
        confidence -= 15
        notes.append(f"{rejected_results} rejected result{'s' if rejected_results != 1 else ''}")
    if warn > 0:
        confidence -= 5 * warn
        notes.append(f"{warn} MIC{'s' if warn != 1 else ''} near limit")
    if not notes:
        notes.append("No quality flags")
    confidence = max(0, min(100, confidence))

    overall_status = "rejected" if failed_mics > 0 or rejected_results > 0 else ("conditional" if warn > 0 else "accepted")

    # Lot history
    lot_history: list[dict] = []
    for r in lot_rows:
        usage = str(r.get("usage_decision") or "").lower()
        if "reject" in usage:
            result = "reject"
        elif usage and "accept" not in usage:
            result = "conditional"
        elif usage:
            result = "accept"
        else:
            result = "conditional"
        lot_history.append({
            "id": str(r.get("id") or ""),
            "date": str(r.get("date") or "").split("T")[0],
            "inspection": str(r.get("inspection") or ""),
            "result": result,
            "mics": failed_mics + accepted_results if (failed_mics or accepted_results) else 0,
            "failed": failed_mics,
            "decisionBy": str(r.get("decision_by") or "—"),
        })

    # Mass balance variance
    b = balance_rows[0] if balance_rows else {}
    produced = float(b.get("produced") or 0)
    consumed = float(b.get("consumed") or 0)
    shipped = float(b.get("shipped") or 0)
    adjusted = float(b.get("adjusted") or 0)
    current = float(b.get("latest_balance") or 0)
    variance = round((produced + adjusted + consumed + shipped - current) * 10) / 10
    variance_note = (
        f"Reconciled — net postings balance to current on-hand."
        if abs(variance) < 0.1
        else f"Unexplained variance of {abs(variance):.1f} {b.get('uom') or 'KG'}."
    )

    # Usage-decision evidence — derived from the latest accepted lot's
    # CREATED_BY. This is NOT a governed signoff / e-signature / release
    # approval. The contract schema deliberately uses
    # `PassportUsageDecisionEvidence` with `decisionType` to make that clear.
    usage_decision_evidence: list[dict] = []
    latest_accept = next(
        (r for r in lot_rows if r.get("usage_decision") and "accept" in str(r.get("usage_decision")).lower()),
        None,
    )
    if latest_accept:
        usage_decision_evidence.append({
            "role": "QA reviewer",
            "decisionBy": str(latest_accept.get("decision_by") or "—"),
            "decisionType": "usage-decision-recorded",
            "recordedAt": str(latest_accept.get("date") or ""),
        })

    # daysToExpiry: compute from identity.expiryDate vs today
    from datetime import datetime, timezone
    days_to_expiry = 0
    expiry = partial["identity"].get("expiryDate") or ""
    if expiry:
        try:
            exp_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00")) if "T" in expiry else datetime.fromisoformat(expiry + "T00:00:00+00:00")
            days_to_expiry = max(0, (exp_dt - datetime.now(timezone.utc)).days)
        except Exception:
            days_to_expiry = 0

    identity = dict(partial["identity"])
    identity["daysToExpiry"] = days_to_expiry

    production = dict(partial["production"])
    if not production.get("orderId"):
        production["orderId"] = identity.get("processOrderId", "")
    if not production.get("originatingCustomer"):
        production["originatingCustomer"] = "—"
    if not production.get("notes"):
        production["notes"] = "Source: gold_batch_production_history_v"

    return {
        "identity": identity,
        "quality": {
            # Heuristic — not a governed QM score. Schema enforces the
            # naming and the `confidenceSource` tag.
            "heuristicQualityConfidence": confidence,
            "confidenceSource": "application-heuristic",
            "heuristicQualityStatus": overall_status,
            "notes": notes,
            "coa": coa,
        },
        "stock": partial["stock"],
        "production": production,
        "lotHistory": lot_history,
        "massBalance": {
            "variance": variance,
            "note": variance_note,
        },
        "usageDecisionEvidence": usage_decision_evidence,
    }
