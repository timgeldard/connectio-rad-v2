"""Routes for the Environmental Monitoring domain.

Databricks mode only (``BACKEND_ADAPTER_MODE=databricks-api``): executes SQL
directly against Unity Catalog using the authenticated user's OAuth token.

No V1 EnvMon backend existed for these routes — 503 is returned in any other
mode. Missing OAuth → 401. Missing config → 503. No silent fallback.

Source: gold_inspection_lot + gold_inspection_point + gold_batch_quality_result_v
Catalog: TRACE_CATALOG (default connected_plant_uat), Schema: TRACE_SCHEMA (default gold)
DDL confirmed: 2026-05-17 (n.txt)
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException, Response

from adapters.envmon.envmon_databricks_adapter import (
    SiteSummaryRequest,
    get_site_summary_spec,
    map_site_summary_rows,
)
from routes._databricks import (
    build_user_identity,
    require_databricks_config,
    run_query,
    set_databricks_response_headers,
)

router = APIRouter()


@router.get("/envmon/site-summary")
async def envmon_site_summary(
    plant_id: str,
    period_start: str,
    period_end: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    """Environmental monitoring site summary KPIs — databricks-api only.

    Returns aggregate inspection results for a plant over the given period.
    Returns a default zero-value shape (not 404) when no data exists for the
    plant/period combination.

    Source views (confirmed-ddl 2026-05-17):
      gold_inspection_lot, gold_inspection_point, gold_batch_quality_result_v
      INSPECTION_TYPE IN ('14','Z14') — EnvMon domain boundary filter

    Partial coverage:
      plantName: "" — requires gold_plant JOIN not yet in SQL (PLACEHOLDER)
      openCorrectiveActions: 0 — contract compatibility only; CAPA is out of scope for EnvMon V2 parity
      overdueActions: 0 — contract compatibility only; CAPA is out of scope for EnvMon V2 parity
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="EnvMon site summary requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_query(
        lambda: get_site_summary_spec(
            SiteSummaryRequest(
                plant_id=plant_id,
                period_start=period_start,
                period_end=period_end,
            )
        ),
        identity, host, warehouse_id,
    )
    set_databricks_response_headers(response, spec)
    return map_site_summary_rows(rows, plant_id)
