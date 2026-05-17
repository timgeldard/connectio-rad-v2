"""POH Databricks-api adapter — QuerySpec factories and row mappers for Process Order Review.

Implemented slices:
  - get_process_order_header_spec / map_process_order_header_rows
  - get_order_operations_spec (QuerySpec only — row mapper deferred)

IMPORTANT: All SQL column names are unverified. They are inferred from SAP PP
naming conventions (AUFNR, AUART, MATNR, etc.) and ADR-024 schema notes.
Every column alias is marked with a TODO comment. Do not remove TODOs until the
column has been confirmed by inspecting the live view DDL or running a test query
against connected_plant_uat.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

# ---------------------------------------------------------------------------
# Status/type mapping tables — all TODO-marked (unverified SAP values)
# ---------------------------------------------------------------------------

# TODO: Verify AUART values against live vw_gold_process_order.
# SAP AUART → V2 contract enum ('process-order' | 'production-order' | 'maintenance-order' | 'planned-order')
_ORDER_TYPE_MAP: dict[str, str] = {
    "PI01": "process-order",
    "PP01": "production-order",
    "PM01": "maintenance-order",
    "PR": "planned-order",
    "PP": "production-order",
}

# TODO: Verify status string values against live vw_gold_process_order data.
# SAP order status keywords → V2 contract enum
# ('created' | 'released' | 'in-process' | 'confirmed' | 'partially-confirmed' | 'closed' | 'cancelled')
_ORDER_STATUS_MAP: dict[str, str] = {
    "CRTD": "created",
    "REL": "released",
    "PCNF": "partially-confirmed",
    "CNF": "confirmed",
    "CLSD": "closed",
    "DLT": "cancelled",
    "CANCEL": "cancelled",
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

    Column note: V1 POH db.py ORDER_STATUS_EXPR uses `po.STATUS` with values
    'IN PROGRESS', 'COMPLETED', 'CLOSED', 'NOT STARTED'. The V2 spec uses
    `objnr` (SAP status object number). TODO: verify which column the gold view
    exposes — status text or SAP objnr.
    """
    order_view = resolve_domain_object("poh", "vw_gold_process_order")
    plant_clause = "AND werks = :plant_id" if request.plant_id else ""

    sql = f"""
    SELECT
        aufnr          AS process_order_id,  -- TODO: verify column name (SAP order number)
        auart          AS order_type,         -- TODO: verify; map AUART code → V2 enum
        matnr          AS material_id,        -- TODO: verify (leading zeros stripped in gold view?)
        maktx          AS material_description,  -- TODO: verify (may be joined from MARA/MAKT)
        charg          AS batch_id,           -- TODO: verify (output batch; may be null for planned orders)
        werks          AS plant_id,           -- TODO: verify
        arbpl          AS production_line,    -- TODO: verify (may need join to CRHD for full description)
        gamng          AS planned_quantity,   -- TODO: verify (total planned order quantity)
        gmein          AS uom,               -- TODO: verify (base unit of measure)
        wemng          AS confirmed_quantity, -- TODO: verify (goods receipt quantity)
        gstrp          AS planned_start,      -- TODO: verify date column (basic start date)
        gltrp          AS planned_finish,     -- TODO: verify date column (basic finish date)
        gstri          AS actual_start,       -- TODO: verify (actual start; null if not started)
        getri          AS actual_finish,      -- TODO: verify (actual finish; null if not complete)
        objnr          AS order_status_raw    -- TODO: verify; V1 uses STATUS text col, not objnr
    FROM {order_view}
    WHERE aufnr = :process_order_id
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

    All field mappings are based on SQL aliases in ``get_process_order_header_spec``.
    Status and type mappings are TODO-marked and will need verification against
    live vw_gold_process_order data before production use.
    """
    if not rows:
        return None
    row = rows[0]

    result: dict[str, object] = {
        "processOrderId": str(row.get("process_order_id") or ""),
        "orderType": _map_order_type(row.get("order_type")),
        "materialId": str(row.get("material_id") or ""),
        "materialDescription": str(row.get("material_description") or ""),
        "plantId": str(row.get("plant_id") or ""),
        "plannedQuantity": _safe_float(row.get("planned_quantity")),
        "confirmedQuantity": _safe_float(row.get("confirmed_quantity")),
        "uom": str(row.get("uom") or ""),
        "plannedStart": _format_datetime(row.get("planned_start")),
        "plannedFinish": _format_datetime(row.get("planned_finish")),
        "orderStatus": _map_order_status(row.get("order_status_raw")),
    }

    if row.get("batch_id"):
        result["batchId"] = str(row["batch_id"])
    if row.get("production_line"):
        result["productionLine"] = str(row["production_line"])
    if row.get("actual_start"):
        result["actualStart"] = _format_datetime(row["actual_start"])
    if row.get("actual_finish"):
        result["actualFinish"] = _format_datetime(row["actual_finish"])

    return result


def _map_order_type(raw: object) -> str:
    if not raw:
        return "process-order"
    return _ORDER_TYPE_MAP.get(str(raw).upper(), "process-order")


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

    Raises DatabricksConfigError if POH_CATALOG is not set.
    """
    ops_view = resolve_domain_object("poh", "vw_gold_process_order_phase")

    sql = f"""
    SELECT
        vornr          AS operation_number,          -- TODO: verify (SAP op sequence, AFVO.VORNR)
        ltxa1          AS operation_text,            -- TODO: verify (short op description, AFVO.LTXA1)
        arbpl          AS work_centre,               -- TODO: verify (work centre ID, AFVO.ARBPL)
        arbpl          AS resource,                  -- TODO: verify resource separately; may require join to CRHD
        fsavd          AS planned_start,             -- TODO: verify (forecast start date, AFVO.FSAVD)
        fsaed          AS planned_finish,            -- TODO: verify (forecast end date, AFVO.FSAED)
        isdd           AS actual_start,              -- TODO: verify (actual start date, AFVO.ISDD)
        iedd           AS actual_finish,             -- TODO: verify (actual end date, AFVO.IEDD)
        stat           AS status_raw,                -- TODO: verify; map to V2 enum (pending/in-progress/confirmed/skipped)
        dauno          AS planned_duration_minutes,  -- TODO: verify units (AFVO.DAUNO may be in hours or minutes)
        iauno          AS actual_duration_minutes,   -- TODO: verify units (AFVO.IAUNO)
        rueck          AS has_confirmation           -- TODO: verify (AFVO.RUECK confirmation counter; > 0 means confirmed)
    FROM {ops_view}
    WHERE aufnr = :process_order_id
    ORDER BY vornr
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
