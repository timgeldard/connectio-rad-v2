"""POH Databricks-api adapter — QuerySpec factories and row mappers for Process Order Review.

Implemented slices:
  - get_process_order_header_spec / map_process_order_header_rows
  - get_order_operations_spec (QuerySpec only — row mapper deferred)

Column verification status (2026-05-17, connected_plant_uat):
  vw_gold_process_order columns confirmed via live DDL:
    PROCESS_ORDER_ID, STATUS, MATERIAL_ID, INSPECTION_LOT_ID, MATERIAL_DESCRIPTION, PLANT_ID
  vw_gold_process_order_phase columns confirmed via live DDL:
    PROCESS_ORDER_PHASE_ID, PROCESS_ORDER_ID, PHASE_ID, PHASE_DESCRIPTION, PHASE_TEXT,
    START_USER, END_USER, OPERATION_QUANTITY, OPERATION_QUANTITY_UOM, SORT_NUMBER

  Fields NOT available in these views (no corresponding columns):
    order_type, batch_id, production_line, planned/confirmed quantities, planned/actual dates
  These fields return empty/default values until a richer view is available.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

# ---------------------------------------------------------------------------
# Status mapping — confirmed against live vw_gold_process_order (2026-05-17)
# The view uses text STATUS values consistent with V1 (not SAP technical codes).
# ---------------------------------------------------------------------------

# STATUS text values → V2 contract enum
# ('created' | 'released' | 'in-process' | 'confirmed' | 'partially-confirmed' | 'closed' | 'cancelled')
# V1 reference: STATUS values include 'IN PROGRESS', 'COMPLETED', 'CLOSED', 'NOT STARTED'
# TODO: verify exact STATUS enum values from live data (DESCRIBE extended or sample query)
_ORDER_STATUS_MAP: dict[str, str] = {
    "NOT STARTED": "created",
    "RELEASED": "released",
    "IN PROGRESS": "in-process",
    "CONFIRMED": "confirmed",
    "PARTIALLY CONFIRMED": "partially-confirmed",
    "COMPLETED": "confirmed",
    "CLOSED": "closed",
    "CANCELLED": "cancelled",
    # SAP technical fallbacks (in case view exposes AUOBJ codes)
    "CRTD": "created",
    "REL": "released",
    "PCNF": "partially-confirmed",
    "CNF": "confirmed",
    "CLSD": "closed",
    "TECO": "closed",
}


@dataclass
class ProcessOrderHeaderRequest:
    process_order_id: str
    plant_id: Optional[str] = None


@dataclass
class OrderOperationsRequest:
    process_order_id: str


def get_process_order_header_spec(request: ProcessOrderHeaderRequest) -> QuerySpec:
    """Return a QuerySpec for getProcessOrderHeader.

    Source view: vw_gold_process_order under POH_CATALOG / POH_SCHEMA.
    Contract: ProcessOrderHeaderSchema (packages/data-contracts)
    Cache: PER_USER_60S — order status changes during a shift.

    Raises DatabricksConfigError if POH_CATALOG is not set.

    Column names confirmed from live DDL (2026-05-17, connected_plant_uat):
      Available: PROCESS_ORDER_ID, STATUS, MATERIAL_ID, INSPECTION_LOT_ID,
                 MATERIAL_DESCRIPTION, PLANT_ID
      Missing from this view: order_type, batch_id, production_line, quantities, dates.
      Those fields return empty/default until a richer view is confirmed.
    """
    order_view = resolve_domain_object("poh", "vw_gold_process_order")
    plant_clause = "AND PLANT_ID = :plant_id" if request.plant_id else ""

    sql = f"""
    SELECT
        PROCESS_ORDER_ID    AS process_order_id,
        STATUS              AS order_status_raw,
        MATERIAL_ID         AS material_id,
        MATERIAL_DESCRIPTION AS material_description,
        PLANT_ID            AS plant_id,
        INSPECTION_LOT_ID   AS inspection_lot_id
    FROM {order_view}
    WHERE PROCESS_ORDER_ID = :process_order_id
    {plant_clause}
    LIMIT :max_rows
    """

    params: dict[str, object] = {"process_order_id": request.process_order_id}
    if request.plant_id:
        params["plant_id"] = request.plant_id

    return QuerySpec(
        name="poh.get_process_order_header",
        module="poh",
        endpoint="/api/por/order-header",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["poh", "process-order", "header"],
    )


def map_process_order_header_rows(rows: list[dict]) -> dict | None:
    """Map raw Databricks rows to the ProcessOrderHeader contract shape.

    Returns ``None`` if *rows* is empty (caller should return 404).

    Field coverage (2026-05-17): vw_gold_process_order provides PROCESS_ORDER_ID,
    STATUS, MATERIAL_ID, MATERIAL_DESCRIPTION, PLANT_ID, INSPECTION_LOT_ID only.
    Fields not in the view (orderType, quantities, dates, batchId, productionLine)
    return empty/zero defaults. These will be populated once a richer view is available.
    """
    if not rows:
        return None
    row = rows[0]

    result: dict[str, object] = {
        "processOrderId": str(row.get("process_order_id") or ""),
        "orderType": "process-order",  # not in view — default
        "materialId": str(row.get("material_id") or ""),
        "materialDescription": str(row.get("material_description") or ""),
        "plantId": str(row.get("plant_id") or ""),
        "plannedQuantity": 0.0,   # not in view
        "confirmedQuantity": 0.0, # not in view
        "uom": "",                # not in view
        "plannedStart": "",       # not in view
        "plannedFinish": "",      # not in view
        "orderStatus": _map_order_status(row.get("order_status_raw")),
    }

    if row.get("inspection_lot_id"):
        result["inspectionLotId"] = str(row["inspection_lot_id"])

    return result


def _map_order_status(raw: object) -> str:
    if not raw:
        return "created"
    raw_upper = str(raw).upper()
    for key, val in _ORDER_STATUS_MAP.items():
        if key in raw_upper:
            return val
    return "created"


def _safe_float(value: object) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


def _format_datetime(value: object) -> str:
    """Normalise a Databricks date/datetime value to an ISO 8601 string."""
    if value is None:
        return ""
    s = str(value).strip()
    if not s or s == "None":
        return ""
    # Databricks may return "2024-01-15 06:00:00.000" — convert space to T
    if " " in s:
        s = s.replace(" ", "T", 1)
    # Date-only: append midnight
    if "T" not in s:
        s = f"{s}T00:00:00"
    return s


def get_order_operations_spec(request: OrderOperationsRequest) -> QuerySpec:
    """Return a QuerySpec for getOrderOperations.

    Source view: vw_gold_process_order_phase under POH_CATALOG / POH_SCHEMA.
    Contract: ProcessOrderOperationSchema[] (packages/data-contracts)
    Cache: PER_USER_60S — operation confirmations post during the shift.

    Column names confirmed from live DDL (2026-05-17, connected_plant_uat):
      PROCESS_ORDER_PHASE_ID, PROCESS_ORDER_ID, PHASE_ID, PHASE_DESCRIPTION,
      PHASE_TEXT, START_USER, END_USER, OPERATION_QUANTITY, OPERATION_QUANTITY_UOM,
      SORT_NUMBER
    Note: no start/finish date columns in this view. Dates not available until a
    richer operations view is confirmed.

    Raises DatabricksConfigError if POH_CATALOG is not set.
    """
    ops_view = resolve_domain_object("poh", "vw_gold_process_order_phase")

    sql = f"""
    SELECT
        PHASE_ID                AS operation_number,
        PHASE_DESCRIPTION       AS operation_text,
        PHASE_TEXT              AS operation_detail,
        OPERATION_QUANTITY      AS planned_quantity,
        OPERATION_QUANTITY_UOM  AS uom,
        SORT_NUMBER             AS sort_number,
        START_USER              AS start_user,
        END_USER                AS end_user
    FROM {ops_view}
    WHERE PROCESS_ORDER_ID = :process_order_id
    ORDER BY SORT_NUMBER
    LIMIT :max_rows
    """

    return QuerySpec(
        name="poh.get_order_operations",
        module="poh",
        endpoint="/api/por/order-header",
        sql=sql,
        params={"process_order_id": request.process_order_id},
        cache_policy=CacheTier.PER_USER_60S,
        tags=["poh", "process-order", "operations"],
    )
