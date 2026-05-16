"""POH Databricks-api adapter — QuerySpec factories for Process Order Review.

Implemented slices:
  - get_process_order_header_spec: maps to ProcessOrderHeaderSchema
  - get_order_operations_spec: maps to ProcessOrderOperationSchema (array)

Route wiring deferred: existing proxy routes in apps/api/routes/process_order.py
forward to V1. Databricks route wiring requires:
  1. Column names verified against live vw_gold_process_order /
     vw_gold_process_order_phase in connected_plant_uat
  2. ADR-024 open questions #1 (Statement API vs Connector) and #7 (cache backend) resolved
  3. POST /api/por/order-header browser-verified against live V1 (for parallel validation)

IMPORTANT: All SQL column names below are unverified. They are inferred from SAP PP
naming conventions (AUFNR, AUART, MATNR, etc.) and ADR-024 schema notes.
Every column alias is marked with a TODO comment. Do not remove TODOs until the
column has been confirmed by inspecting the live view DDL or running a test query
against connected_plant_uat.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.query_spec import QuerySpec


@dataclass
class ProcessOrderHeaderRequest:
    process_order_id: str
    plant_id: Optional[str] = None


@dataclass
class OrderOperationsRequest:
    process_order_id: str


def get_process_order_header_spec(request: ProcessOrderHeaderRequest) -> QuerySpec:
    """Return a QuerySpec for getProcessOrderHeader.

    Source view: vw_gold_process_order (connected_plant_uat)
    Contract: ProcessOrderHeaderSchema (packages/data-contracts)
    Cache: PER_USER_60S — order status changes during a shift.
    """
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
        objnr          AS order_status_raw    -- TODO: verify; map status bits → V2 enum
    FROM vw_gold_process_order
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


def get_order_operations_spec(request: OrderOperationsRequest) -> QuerySpec:
    """Return a QuerySpec for getOrderOperations.

    Source view: vw_gold_process_order_phase (connected_plant_uat)
    Contract: ProcessOrderOperationSchema[] (packages/data-contracts)
    Cache: PER_USER_60S — operation confirmations post during the shift.
    """
    sql = """
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
    FROM vw_gold_process_order_phase
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
