"""Warehouse360 Databricks-api adapter — QuerySpec factories and row mappers.

Provides high-performance, parameterised SQL queries and defensive row mappers
for Warehouse360 cockpit, inbound, outbound, staging, and exception monitoring.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec


@dataclass
class WarehouseOverviewRequest:
    warehouse_id: str
    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    limit: int = 100


@dataclass
class WarehouseInboundRequest:
    warehouse_id: str
    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    limit: int = 100


@dataclass
class WarehouseOutboundRequest:
    warehouse_id: str
    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    limit: int = 100


@dataclass
class WarehouseStagingRequest:
    warehouse_id: str
    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    limit: int = 100


@dataclass
class WarehouseExceptionRequest:
    warehouse_id: str
    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    limit: int = 100


# ---------------------------------------------------------------------------
# Utility Mapping & Formatting Helpers
# ---------------------------------------------------------------------------

def _safe_float(value: object) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


def _safe_int(value: object) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0


def _format_datetime(value: object) -> str:
    """Normalise a Databricks date/datetime value to an ISO 8601 string."""
    if value is None:
        return ""
    s = str(value).strip()
    if not s or s == "None":
        return ""
    if " " in s:
        s = s.replace(" ", "T", 1)
    if "T" not in s:
        s = f"{s}T00:00:00"
    return s


def _map_exception_severity(severity_raw: object, days_to_expiry_raw: object) -> str:
    """Map exception severity.
    
    If days_to_expiry is provided:
      - days < 0 (expired) -> critical
      - days <= 7 -> high
      - days <= 30 -> medium
      - else -> low
    
    Fallback to raw severity mapping if daysToExpiry is missing.
    """
    if days_to_expiry_raw is not None:
        try:
            days = int(days_to_expiry_raw)
            if days < 0:
                return "critical"
            elif days <= 7:
                return "high"
            elif days <= 30:
                return "medium"
            else:
                return "low"
        except (ValueError, TypeError):
            pass

    if severity_raw:
        s = str(severity_raw).lower().strip()
        if s in ("critical", "high", "medium", "low"):
            return s
        if s == "warning":
            return "medium"
        if s == "caution":
            return "low"

    return "low"


# ---------------------------------------------------------------------------
# QuerySpec Factories & Row Mappers
# ---------------------------------------------------------------------------

def get_warehouse_overview_spec(request: WarehouseOverviewRequest) -> QuerySpec:
    """Return QuerySpec for Warehouse KPI Snapshot.

    Source view: wh360_kpi_snapshot_v — global single-row KPI summary.
    No warehouse_id filter: the view pre-aggregates across all warehouses.
    """
    view = resolve_domain_object("wh360", "wh360_kpi_snapshot_v")
    sql = f"""
    SELECT
        orders_total,
        orders_red,
        orders_amber,
        trs_open,
        tos_open,
        deliveries_today,
        deliveries_at_risk,
        inbound_open,
        bins_blocked,
        bins_total,
        bin_util_pct
    FROM {view}
    LIMIT 1
    """
    return QuerySpec(
        name="warehouse360.get_overview",
        module="wh360",
        endpoint="/api/warehouse360/overview",
        sql=sql,
        params={},
        cache_policy=CacheTier.GLOBAL_300S,
        tags=["wh360", "cockpit", "overview"],
    )


def map_warehouse_overview_rows(rows: list[dict], request: WarehouseOverviewRequest) -> dict:
    """Map raw overview rows to Warehouse360Overview schema.

    wh360_kpi_snapshot_v is a global single-row summary with no warehouse_id
    column. warehouseId in the response is populated from the request for
    API consistency.
    """
    if not rows:
        return {
            "warehouseId": request.warehouse_id,
            "ordersTotal": 0,
            "ordersRed": 0,
            "ordersAmber": 0,
            "trsOpen": 0,
            "tosOpen": 0,
            "deliveriesToday": 0,
            "deliveriesAtRisk": 0,
            "inboundOpen": 0,
            "binsBlocked": 0,
            "binsTotal": 0,
            "binUtilPct": 0.0,
        }

    row = rows[0]
    return {
        "warehouseId": request.warehouse_id,
        "ordersTotal": _safe_int(row.get("orders_total")),
        "ordersRed": _safe_int(row.get("orders_red")),
        "ordersAmber": _safe_int(row.get("orders_amber")),
        "trsOpen": _safe_int(row.get("trs_open")),
        "tosOpen": _safe_int(row.get("tos_open")),
        "deliveriesToday": _safe_int(row.get("deliveries_today")),
        "deliveriesAtRisk": _safe_int(row.get("deliveries_at_risk")),
        "inboundOpen": _safe_int(row.get("inbound_open")),
        "binsBlocked": _safe_int(row.get("bins_blocked")),
        "binsTotal": _safe_int(row.get("bins_total")),
        "binUtilPct": _safe_float(row.get("bin_util_pct")),
    }


def get_warehouse_inbound_spec(request: WarehouseInboundRequest) -> QuerySpec:
    """Return QuerySpec for Inbound POs & STOs.

    Source view: wh360_inbound_v (connected_plant_uat, verified 2026-05-19 in
    docs/data-layer/warehouse360-inbound-source-verification.md).

    Actual columns: po_id, po_item, doc_type, doc_cat, vendor_id, vendor_name,
    plant_id, storage_loc, material_id, material_name, ordered_qty, gr_qty,
    uom, delivery_date, po_date, delivery_complete, open_qty, qa_lot_id,
    qa_status. No LGNUM/WAREHOUSE_NUMBER, no STO id, no exception_reason —
    those contract fields are emitted as null by the mapper.

    The request still carries warehouse_id for backwards-compatibility, but
    the SQL does NOT filter on it (the view does not expose LGNUM). A
    follow-up will reintroduce the filter once a LGNUM-bearing source is
    confirmed.
    """
    view = resolve_domain_object("wh360", "wh360_inbound_v")
    where_clauses: list[str] = []
    params: dict[str, object] = {}

    if request.plant_id:
        where_clauses.append("plant_id = :plant_id")
        params["plant_id"] = request.plant_id
    if request.date_from:
        where_clauses.append("delivery_date >= :date_from")
        params["date_from"] = request.date_from
    if request.date_to:
        where_clauses.append("delivery_date <= :date_to")
        params["date_to"] = request.date_to

    where_str = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    sql = f"""
    SELECT
        po_id,
        po_item,
        doc_type,
        doc_cat,
        vendor_id,
        vendor_name,
        plant_id,
        storage_loc,
        material_id,
        material_name,
        ordered_qty,
        gr_qty,
        open_qty,
        uom,
        delivery_date,
        po_date,
        delivery_complete,
        qa_lot_id,
        qa_status
    FROM {view}
    {where_str}
    LIMIT {request.limit}
    """
    return QuerySpec(
        name="warehouse360.get_inbound",
        module="wh360",
        endpoint="/api/warehouse360/inbound",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wh360", "inbound", "receipts"],
    )


def _derive_inbound_document_type(doc_type: object) -> str:
    """Normalise wh360_inbound_v.doc_type to the contract enum.

    The source value is a free-text SAP code; we map known PO/STO patterns
    and default everything else to 'unknown' rather than guessing.
    """
    raw = str(doc_type or "").upper().strip()
    if not raw:
        return "unknown"
    if "STO" in raw or "TRANS" in raw:
        return "STO"
    if "PO" in raw or "PURCHASE" in raw or raw.startswith("Z"):
        return "PO"
    return "unknown"


def _derive_inbound_document_status(row: dict) -> Optional[str]:
    """Derive a coarse document status from delivery_complete + open_qty.

    [classification: application-heuristic]

    The view has no dedicated document-status column. We expose:
      - 'received' when delivery_complete == 'Y'
      - 'open'     when delivery_complete != 'Y' and open_qty > 0
      - None       otherwise (e.g. delivery_complete='Y' AND open_qty=0
                   are both consistent with 'received'; we already covered)

    `qa_status` carries QA lot disposition and is NOT a document status —
    it is exposed in the dedicated `status` field only as derived inbound
    state. A future contract split may add a `qaStatus` field; until then
    qa_status is intentionally not surfaced here to avoid relabelling QA
    decisions as document state.
    """
    complete = str(row.get("delivery_complete") or "").strip().upper()
    if complete == "Y":
        return "received"
    open_qty = _safe_float(row.get("open_qty"))
    if open_qty > 0:
        return "open"
    return None


def map_warehouse_inbound_rows(rows: list[dict]) -> list[dict]:
    """Map raw inbound rows to Warehouse360InboundItem schema.

    Source columns documented in
    docs/data-layer/warehouse360-inbound-source-verification.md §3.

    Source-truthful guardrails:
      - warehouseNumber, stockTransportOrderId, supplyingPlantId,
        exceptionReason are absent from wh360_inbound_v; the mapper emits
        null rather than empty strings or invented values.
      - unitOfMeasure echoes uom verbatim (no KG default).
      - quantity maps to open_qty (still-due quantity) — the contract has
        only one quantity field today.
      - status is a coarse heuristic; classified as application-heuristic.
      - receivedDate is delivery_date only when delivery_complete='Y'.
    """
    result = []
    for row in rows:
        document_status = _derive_inbound_document_status(row)
        is_complete = str(row.get("delivery_complete") or "").strip().upper() == "Y"

        result.append({
            "documentType": _derive_inbound_document_type(row.get("doc_type")),
            "purchaseOrderId": str(row["po_id"]) if row.get("po_id") else None,
            # STO identifier is absent in wh360_inbound_v — see source-verification doc §3.
            "stockTransportOrderId": None,
            "itemId": str(row["po_item"]) if row.get("po_item") is not None else None,
            "vendorId": str(row["vendor_id"]) if row.get("vendor_id") else None,
            # Supplying plant for STOs is absent in this view.
            "supplyingPlantId": None,
            "materialId": str(row.get("material_id") or ""),
            "materialDescription": str(row["material_name"]) if row.get("material_name") else None,
            # Inbound PO lines have no GR-batch until receipt happens; null is source-truthful.
            "batchId": None,
            "plantId": str(row["plant_id"]) if row.get("plant_id") else None,
            "storageLocation": str(row["storage_loc"]) if row.get("storage_loc") else None,
            # LGNUM/warehouse number is absent in wh360_inbound_v.
            "warehouseNumber": None,
            "expectedDate": _format_datetime(row.get("delivery_date")) or None,
            # receivedDate is the delivery_date only when the line is complete.
            "receivedDate": (
                _format_datetime(row.get("delivery_date")) or None if is_complete else None
            ),
            "quantity": _safe_float(row.get("open_qty")) if row.get("open_qty") is not None else None,
            "unitOfMeasure": str(row["uom"]) if row.get("uom") else None,
            "status": document_status,
            # No exception_reason column in the source view.
            "exceptionReason": None,
        })
    return result


def get_warehouse_outbound_spec(request: WarehouseOutboundRequest) -> QuerySpec:
    """Return QuerySpec for Outbound Deliveries.

    Source view: wh360_deliveries_v
    """
    view = resolve_domain_object("wh360", "wh360_deliveries_v")
    where_clauses = ["WAREHOUSE_NUMBER = :warehouse_id"]
    params = {"warehouse_id": request.warehouse_id}

    if request.plant_id:
        where_clauses.append("PLANT_ID = :plant_id")
        params["plant_id"] = request.plant_id
    if request.date_from:
        where_clauses.append("PLANNED_GOODS_ISSUE_DATE >= :date_from")
        params["date_from"] = request.date_from
    if request.date_to:
        where_clauses.append("PLANNED_GOODS_ISSUE_DATE <= :date_to")
        params["date_to"] = request.date_to

    where_str = " AND ".join(where_clauses)
    sql = f"""
    SELECT
        DELIVERY_ID               AS delivery_id,
        DELIVERY_ITEM_ID          AS delivery_item_id,
        CUSTOMER_ID               AS customer_id,
        SALES_ORDER_ID            AS sales_order_id,
        MATERIAL_ID               AS material_id,
        MATERIAL_DESCRIPTION      AS material_description,
        BATCH_ID                  AS batch_id,
        PLANT_ID                  AS plant_id,
        STORAGE_LOCATION          AS storage_location,
        WAREHOUSE_NUMBER          AS warehouse_number,
        PLANNED_GOODS_ISSUE_DATE  AS planned_goods_issue_date,
        ACTUAL_GOODS_ISSUE_DATE    AS actual_goods_issue_date,
        QUANTITY                  AS quantity,
        UNIT_OF_MEASURE           AS unit_of_measure,
        STATUS                    AS status,
        EXCEPTION_REASON          AS exception_reason
    FROM {view}
    WHERE {where_str}
    LIMIT {request.limit}
    """
    return QuerySpec(
        name="warehouse360.get_outbound",
        module="wh360",
        endpoint="/api/warehouse360/outbound",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wh360", "outbound", "deliveries"],
    )


def map_warehouse_outbound_rows(rows: list[dict]) -> list[dict]:
    """Map raw outbound rows to Warehouse360OutboundItem schema."""
    result = []
    for row in rows:
        result.append({
            "deliveryId": str(row.get("delivery_id") or ""),
            "deliveryItemId": str(row.get("delivery_item_id") or ""),
            "customerId": str(row.get("customer_id") or ""),
            "salesOrderId": str(row.get("sales_order_id") or ""),
            "materialId": str(row.get("material_id") or ""),
            "materialDescription": str(row.get("material_description") or ""),
            "batchId": str(row.get("batch_id") or ""),
            "plantId": str(row.get("plant_id") or ""),
            "storageLocation": str(row.get("storage_location") or ""),
            "warehouseNumber": str(row.get("warehouse_number") or ""),
            "plannedGoodsIssueDate": _format_datetime(row.get("planned_goods_issue_date")),
            "actualGoodsIssueDate": _format_datetime(row.get("actual_goods_issue_date")),
            "quantity": _safe_float(row.get("quantity")),
            "unitOfMeasure": str(row.get("unit_of_measure") or ""),
            "status": str(row.get("status") or ""),
            "exceptionReason": str(row.get("exception_reason") or ""),
        })
    return result


def get_warehouse_staging_spec(request: WarehouseStagingRequest) -> QuerySpec:
    """Return QuerySpec for Production Staging Demands.

    Source view: staging_orders_v
    """
    view = resolve_domain_object("wh360", "staging_orders_v")
    where_clauses = ["WAREHOUSE_NUMBER = :warehouse_id"]
    params = {"warehouse_id": request.warehouse_id}

    if request.plant_id:
        where_clauses.append("PLANT_ID = :plant_id")
        params["plant_id"] = request.plant_id
    if request.date_from:
        where_clauses.append("REQUIREMENT_DATE >= :date_from")
        params["date_from"] = request.date_from
    if request.date_to:
        where_clauses.append("REQUIREMENT_DATE <= :date_to")
        params["date_to"] = request.date_to

    where_str = " AND ".join(where_clauses)
    sql = f"""
    SELECT
        PROCESS_ORDER_ID          AS process_order_id,
        RESERVATION_ID            AS reservation_id,
        RESERVATION_ITEM_ID       AS reservation_item_id,
        MATERIAL_ID               AS material_id,
        MATERIAL_DESCRIPTION      AS material_description,
        BATCH_ID                  AS batch_id,
        PLANT_ID                  AS plant_id,
        STORAGE_LOCATION          AS storage_location,
        WAREHOUSE_NUMBER          AS warehouse_number,
        REQUIREMENT_DATE          AS requirement_date,
        REQUIRED_QUANTITY         AS required_quantity,
        STAGED_QUANTITY           AS staged_quantity,
        OPEN_QUANTITY             AS open_quantity,
        UNIT_OF_MEASURE           AS unit_of_measure,
        STAGING_STATUS            AS staging_status,
        EXCEPTION_REASON          AS exception_reason
    FROM {view}
    WHERE {where_str}
    LIMIT {request.limit}
    """
    return QuerySpec(
        name="warehouse360.get_staging",
        module="wh360",
        endpoint="/api/warehouse360/staging",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wh360", "production", "staging"],
    )


def map_warehouse_staging_rows(rows: list[dict]) -> list[dict]:
    """Map raw staging rows to Warehouse360StagingItem schema."""
    result = []
    for row in rows:
        result.append({
            "processOrderId": str(row.get("process_order_id") or ""),
            "reservationId": str(row.get("reservation_id") or ""),
            "reservationItemId": str(row.get("reservation_item_id") or ""),
            "materialId": str(row.get("material_id") or ""),
            "materialDescription": str(row.get("material_description") or ""),
            "batchId": str(row.get("batch_id") or ""),
            "plantId": str(row.get("plant_id") or ""),
            "storageLocation": str(row.get("storage_location") or ""),
            "warehouseNumber": str(row.get("warehouse_number") or ""),
            "requirementDate": _format_datetime(row.get("requirement_date")),
            "requiredQuantity": _safe_float(row.get("required_quantity")),
            "stagedQuantity": _safe_float(row.get("staged_quantity")),
            "openQuantity": _safe_float(row.get("open_quantity")),
            "unitOfMeasure": str(row.get("unit_of_measure") or ""),
            "stagingStatus": str(row.get("staging_status") or ""),
            "exceptionReason": str(row.get("exception_reason") or ""),
        })
    return result


def get_warehouse_exceptions_spec(request: WarehouseExceptionRequest) -> QuerySpec:
    """Return QuerySpec for IM/WM Reconciliation Exceptions.

    Source view: wh360_imwm_exceptions_v
    """
    view = resolve_domain_object("wh360", "wh360_imwm_exceptions_v")
    where_clauses = ["WAREHOUSE_NUMBER = :warehouse_id"]
    params = {"warehouse_id": request.warehouse_id}

    if request.plant_id:
        where_clauses.append("PLANT_ID = :plant_id")
        params["plant_id"] = request.plant_id
    if request.date_from:
        where_clauses.append("EXPIRY_DATE >= :date_from")
        params["date_from"] = request.date_from
    if request.date_to:
        where_clauses.append("EXPIRY_DATE <= :date_to")
        params["date_to"] = request.date_to

    where_str = " AND ".join(where_clauses)
    sql = f"""
    SELECT
        EXCEPTION_TYPE            AS exception_type,
        SEVERITY                  AS severity,
        MATERIAL_ID               AS material_id,
        BATCH_ID                  AS batch_id,
        PLANT_ID                  AS plant_id,
        STORAGE_LOCATION          AS storage_location,
        WAREHOUSE_NUMBER          AS warehouse_number,
        QUANTITY                  AS quantity,
        UNIT_OF_MEASURE           AS unit_of_measure,
        EXPIRY_DATE               AS expiry_date,
        DAYS_TO_EXPIRY            AS days_to_expiry,
        DOCUMENT_ID               AS document_id,
        PROCESS_ORDER_ID          AS process_order_id,
        DELIVERY_ID               AS delivery_id,
        PURCHASE_ORDER_ID         AS purchase_order_id,
        REASON                    AS reason,
        RECOMMENDED_REVIEW_ACTION  AS recommended_review_action
    FROM {view}
    WHERE {where_str}
    LIMIT {request.limit}
    """
    return QuerySpec(
        name="warehouse360.get_exceptions",
        module="wh360",
        endpoint="/api/warehouse360/exceptions",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wh360", "reconciliation", "exceptions"],
    )


def map_warehouse_exceptions_rows(rows: list[dict]) -> list[dict]:
    """Map raw exceptions rows to Warehouse360ExceptionItem schema."""
    result = []
    for row in rows:
        # Determine severity deterministically
        severity = _map_exception_severity(row.get("severity"), row.get("days_to_expiry"))

        result.append({
            "exceptionType": str(row.get("exception_type") or ""),
            "severity": severity,
            "materialId": str(row.get("material_id") or ""),
            "batchId": str(row.get("batch_id") or ""),
            "plantId": str(row.get("plant_id") or ""),
            "storageLocation": str(row.get("storage_location") or ""),
            "warehouseNumber": str(row.get("warehouse_number") or ""),
            "quantity": _safe_float(row.get("quantity")),
            "unitOfMeasure": str(row.get("unit_of_measure") or ""),
            "expiryDate": _format_datetime(row.get("expiry_date")),
            "daysToExpiry": _safe_int(row.get("days_to_expiry")),
            "documentId": str(row.get("document_id") or ""),
            "processOrderId": str(row.get("process_order_id") or ""),
            "deliveryId": str(row.get("delivery_id") or ""),
            "purchaseOrderId": str(row.get("purchase_order_id") or ""),
            "reason": str(row.get("reason") or ""),
            "recommendedReviewAction": str(row.get("recommended_review_action") or ""),
        })
    return result
