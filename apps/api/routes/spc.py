"""Routes for the SPC (Statistical Process Control) domain.

Default mode (``BACKEND_ADAPTER_MODE=legacy-api``): forwards requests to the
V1 SPC FastAPI backend at ``V1_SPC_API_BASE_URL``.

Databricks mode (``BACKEND_ADAPTER_MODE=databricks-api``):
  GET /spc/subgroups  — implemented (slice 1, 2026-05-22). Queries
    spc_quality_metric_subgroup_mv directly. See spc_databricks_adapter.py.
  All other routes — return 503 in databricks-api mode.

Proxy routes wired here (NOT yet browser-verified against live V1 UAT):
  GET  /spc/materials      → V1 /api/spc/materials
  GET  /spc/plants         → V1 /api/spc/plants?material_id=...
  GET  /spc/characteristics → V1 /api/spc/characteristics?material_id=...&plant_id=...
  POST /spc/chart-data     → V1 /api/spc/chart-data

These routes will remain in "wired but not browser-verified" state until end-to-end
testing against a live V1 SPC UAT deployment is complete.

Auth: end-user Bearer token forwarded via x-forwarded-access-token header.
No service-principal fallback for user-facing reads (Databricks identity policy).
"""
from __future__ import annotations

import os
from datetime import date as _date
from typing import Annotated, Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Query, Response
from pydantic import BaseModel

from adapters.spc.spc_databricks_adapter import (
    MAX_SUBGROUPS,
    SpcSubgroupsRepository,
    SubgroupsRequest,
    map_spc_subgroup_rows,
)
from contracts.generated import SPCSubgroupResponse
from contracts.spc import SpcChartDataRequest, SpcChartDataResponse
from adapters.spc.spc_databricks_chart_adapter import (
    SpcChartDataRepository,
    map_spc_chart_response,
)
import asyncio
from datetime import datetime

from routes._databricks import (
    build_databricks_repository,
    build_user_identity,
    require_databricks_config,
    run_repository_fetch,
    set_databricks_response_headers,
    run_query,
)
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

router = APIRouter()

_V1_BASE_URL = os.getenv("V1_SPC_API_BASE_URL", "")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _require_v1_base_url() -> str:
    """Raise 503 if V1_SPC_API_BASE_URL is not configured."""
    if not _V1_BASE_URL:
        raise HTTPException(
            status_code=503,
            detail="V1_SPC_API_BASE_URL is not configured. "
                   "Set this env var to the V1 SPC FastAPI app URL.",
        )
    return _V1_BASE_URL


def _auth_headers(token: str | None) -> dict:
    headers = {"Accept": "application/json"}
    if token:
        headers["x-forwarded-access-token"] = token
    return headers


async def _forward_get(path: str, params: dict, token: str | None) -> dict | list:
    base = _require_v1_base_url()
    # Strip None values — httpx omits them automatically but be explicit
    clean_params = {k: v for k, v in params.items() if v is not None}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{base}{path}",
                params=clean_params,
                headers=_auth_headers(token),
            )
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        raise HTTPException(status_code=502, detail=f"V1 SPC upstream unreachable: {exc}") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="V1 SPC upstream returned 401 Unauthorized")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="V1 SPC upstream returned 404 Not Found")
    if not response.is_success:
        raise HTTPException(status_code=502, detail=f"V1 SPC upstream returned {response.status_code}")

    return response.json()


async def _forward_post(path: str, body: dict, token: str | None) -> dict | list:
    base = _require_v1_base_url()
    headers = {**_auth_headers(token), "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{base}{path}", json=body, headers=headers)
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        raise HTTPException(status_code=502, detail=f"V1 SPC upstream unreachable: {exc}") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="V1 SPC upstream returned 401 Unauthorized")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="V1 SPC upstream returned 404 Not Found")
    if not response.is_success:
        raise HTTPException(status_code=502, detail=f"V1 SPC upstream returned {response.status_code}")

    return response.json()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------





# ---------------------------------------------------------------------------
# Proxy routes
# ---------------------------------------------------------------------------


@router.get("/spc/materials")
async def spc_materials(
    response: Response = None,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
    x_databricks_catalog: str | None = Header(default=None),
) -> list:
    """List all materials with SPC data.

    Proxies to V1 GET /api/spc/materials — queries spc_material_dim_mv.

    NOT YET BROWSER-VERIFIED: route is wired but has not been tested against
    a live V1 SPC UAT deployment.
    """
    mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if mode == "databricks-api":
        host, warehouse_id = require_databricks_config()
        identity = build_user_identity(
            x_forwarded_access_token,
            x_forwarded_user,
            x_forwarded_email,
            x_databricks_catalog,
        )
        
        r_tbl = resolve_domain_object("spc", "gold_batch_quality_result_v")
        m_tbl = resolve_domain_object("spc", "gold_material")
        
        sql = f"""
            SELECT DISTINCT
                r.MATERIAL_ID   AS material_id,
                COALESCE(m.MATERIAL_NAME, r.MATERIAL_ID) AS material_name
            FROM {r_tbl} r
            LEFT JOIN {m_tbl} m
                ON m.MATERIAL_ID = r.MATERIAL_ID
               AND m.LANGUAGE_ID = 'E'
            WHERE r.QUANTITATIVE_RESULT IS NOT NULL
              AND (r.QUALITATIVE_RESULT IS NULL OR r.QUALITATIVE_RESULT = '')
            ORDER BY material_name
        """
        
        spec = QuerySpec(
            name="spc.get_materials",
            module="spc",
            endpoint="/api/spc/materials",
            sql=sql,
            params={},
            source_badge="view:gold_batch_quality_result_v",
            tags=["spc", "materials"],
        )
        
        rows, spec = await run_query(lambda: spec, identity, host, warehouse_id)
        set_databricks_response_headers(response, spec)
        return rows

    _ensure_legacy_mode()
    return await _forward_get("/api/spc/materials", {}, x_forwarded_access_token)


@router.get("/spc/plants")
async def spc_plants(
    material_id: str = Query(..., description="SAP material number to filter plant list"),
    response: Response = None,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
    x_databricks_catalog: str | None = Header(default=None),
) -> list:
    """List plants that have SPC data for the given material.

    Proxies to V1 GET /api/spc/plants?material_id=... — queries spc_plant_material_dim_mv.

    NOT YET BROWSER-VERIFIED: route is wired but has not been tested against
    a live V1 SPC UAT deployment.
    """
    mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if mode == "databricks-api":
        host, warehouse_id = require_databricks_config()
        identity = build_user_identity(
            x_forwarded_access_token,
            x_forwarded_user,
            x_forwarded_email,
            x_databricks_catalog,
        )
        
        mb_tbl = resolve_domain_object("spc", "gold_batch_mass_balance_v")
        p_tbl = resolve_domain_object("spc", "gold_plant")
        r_tbl = resolve_domain_object("spc", "gold_batch_quality_result_v")
        
        sql = f"""
            SELECT DISTINCT
                mb.PLANT_ID AS plant_id,
                COALESCE(p.PLANT_NAME, mb.PLANT_ID) AS plant_name
            FROM {mb_tbl} mb
            LEFT JOIN {p_tbl} p
                ON p.PLANT_ID = mb.PLANT_ID
            INNER JOIN {r_tbl} r
                ON r.MATERIAL_ID = mb.MATERIAL_ID
               AND r.BATCH_ID    = mb.BATCH_ID
               AND r.QUANTITATIVE_RESULT IS NOT NULL
            WHERE mb.MATERIAL_ID = :material_id
              AND mb.MOVEMENT_CATEGORY = 'Production'
            ORDER BY plant_name
        """
        
        spec = QuerySpec(
            name="spc.get_plants",
            module="spc",
            endpoint="/api/spc/plants",
            sql=sql,
            params={"material_id": material_id},
            source_badge="view:gold_batch_mass_balance_v",
            tags=["spc", "plants"],
        )
        
        rows, spec = await run_query(lambda: spec, identity, host, warehouse_id)
        set_databricks_response_headers(response, spec)
        return rows

    _ensure_legacy_mode()
    return await _forward_get("/api/spc/plants", {"material_id": material_id}, x_forwarded_access_token)


@router.get("/spc/characteristics")
async def spc_characteristics(
    material_id: str = Query(..., description="SAP material number"),
    plant_id: str | None = Query(default=None, description="Plant ID (optional filter)"),
    response: Response = None,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
    x_databricks_catalog: str | None = Header(default=None),
) -> list:
    """List monitored inspection characteristics (MICs) for a material.

    Proxies to V1 GET /api/spc/characteristics?material_id=...&plant_id=... —
    queries spc_characteristic_dim_mv.

    NOT YET BROWSER-VERIFIED: route is wired but has not been tested against
    a live V1 SPC UAT deployment.
    """
    mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if mode == "databricks-api":
        host, warehouse_id = require_databricks_config()
        identity = build_user_identity(
            x_forwarded_access_token,
            x_forwarded_user,
            x_forwarded_email,
            x_databricks_catalog,
        )
        
        r_tbl = resolve_domain_object("spc", "gold_batch_quality_result_v")
        
        sql = f"""
            SELECT
                MIC_ID                                                       AS mic_id,
                MIC_NAME                                                     AS mic_name,
                INSPECTION_METHOD                                            AS inspection_method,
                MAX(CASE WHEN QUALITATIVE_RESULT IS NOT NULL
                              AND QUALITATIVE_RESULT != ''
                         THEN 1 ELSE 0 END)                                 AS is_attribute,
                COUNT(DISTINCT BATCH_ID)                                     AS batch_count,
                COUNT(*)                                                     AS total_samples
            FROM {r_tbl}
            WHERE MATERIAL_ID = :material_id
              AND (QUANTITATIVE_RESULT IS NOT NULL
                   OR (QUALITATIVE_RESULT IS NOT NULL AND QUALITATIVE_RESULT != ''))
            GROUP BY MIC_ID, MIC_NAME, INSPECTION_METHOD
            HAVING COUNT(DISTINCT BATCH_ID) >= 3
            ORDER BY mic_name
        """
        
        spec = QuerySpec(
            name="spc.get_characteristics",
            module="spc",
            endpoint="/api/spc/characteristics",
            sql=sql,
            params={"material_id": material_id},
            source_badge="view:gold_batch_quality_result_v",
            tags=["spc", "characteristics"],
        )
        
        rows, spec = await run_query(lambda: spec, identity, host, warehouse_id)
        set_databricks_response_headers(response, spec)
        
        mapped_rows = []
        for row in rows:
            is_attr = int(float(row.get("is_attribute") or 0)) == 1
            total_samples = float(row.get("total_samples") or 0)
            batch_count = int(float(row.get("batch_count") or 0))
            avg_spb = total_samples / batch_count if batch_count > 0 else 0
            chart_type = "p_chart" if is_attr else ("xbar_r" if avg_spb > 1.5 else "imr")
            
            mapped_rows.append({
                "mic_id": row.get("mic_id"),
                "mic_name": row.get("mic_name"),
                "plant_id": plant_id,
                "material_id": material_id,
                "operation_id": "00000001",
                "chart_type": chart_type,
                "batch_count": batch_count,
                "sample_count": int(total_samples),
                "has_active_signal": False
            })
        return mapped_rows

    _ensure_legacy_mode()
    return await _forward_get(
        "/api/spc/characteristics",
        {"material_id": material_id, "plant_id": plant_id},
        x_forwarded_access_token,
    )


@router.get("/spc/capability")
async def spc_capability(
    material_id: str = Query(..., description="SAP material number"),
    characteristic_id: str = Query(..., description="Characteristic ID"),
    plant_id: str | None = Query(default=None, description="Plant ID (optional filter)"),
    x_forwarded_access_token: str | None = Header(default=None),
) -> dict:
    """Fetch characteristic capability (Cp/Cpk) summary.

    Proxies to V1 GET /api/spc/capability — queries spc_capability_detail_mv.

    NOT YET BROWSER-VERIFIED: route is wired but has not been tested against
    a live V1 SPC UAT deployment.
    """
    _ensure_legacy_mode()
    return await _forward_get(
        "/api/spc/capability",
        {"material_id": material_id, "mic_id": characteristic_id, "plant_id": plant_id},
        x_forwarded_access_token,
    )



@router.post("/spc/chart-data")
async def spc_chart_data(
    body: SpcChartDataRequest,
    response: Response = None,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
    x_databricks_catalog: str | None = Header(default=None),
) -> dict | list:
    """Fetch subgroup chart data for a material/MIC combination."""
    mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if mode == "databricks-api":
        if body.plant_id == _P999_SENTINEL:
            raise HTTPException(status_code=422, detail="P999 is a test sentinel and cannot be used in production queries.")
            
        if not body.material_id or not body.plant_id or not body.mic_id or not body.operation_id:
            raise HTTPException(status_code=422, detail="material_id, plant_id, mic_id, and operation_id are required and cannot be blank.")
            
        if not body.date_from or not body.date_to:
            raise HTTPException(status_code=422, detail="date_from and date_to are required.")
            
        try:
            d_from = datetime.fromisoformat(body.date_from).date()
            d_to = datetime.fromisoformat(body.date_to).date()
            body.date_from = d_from.isoformat()
            body.date_to = d_to.isoformat()
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid date format. Expected YYYY-MM-DD.")
            
        if d_from > d_to:
            raise HTTPException(status_code=422, detail="date_from must be on or before date_to.")
            
        if (d_to - d_from).days > _MAX_DATE_WINDOW_DAYS:
            raise HTTPException(
                status_code=422,
                detail=f"Date window exceeds maximum of {_MAX_DATE_WINDOW_DAYS} days. "
                       "Narrow the date range to prevent broad scans of the source MV.",
            )

        host, warehouse_id = require_databricks_config()
        identity = build_user_identity(
            x_forwarded_access_token,
            x_forwarded_user,
            x_forwarded_email,
            x_databricks_catalog,
        )
        chart_repository = SpcChartDataRepository(
            build_databricks_repository(identity, host, warehouse_id)
        )

        if body.chart_type:
            (subgroups_rows, subgroups_spec), (limits_rows, _limits_spec) = await asyncio.gather(
                run_repository_fetch(
                    lambda: chart_repository.fetch_chart_subgroups(body)
                ),
                run_repository_fetch(
                    lambda: chart_repository.fetch_locked_limits(body)
                ),
            )
        else:
            subgroups_rows, subgroups_spec = await run_repository_fetch(
                lambda: chart_repository.fetch_chart_subgroups(body)
            )
            limits_rows = []

        set_databricks_response_headers(response, subgroups_spec)
        
        queried_at = datetime.utcnow().isoformat() + "Z"
        result = map_spc_chart_response(subgroups_rows, limits_rows, body, queried_at)
        return SpcChartDataResponse.model_validate(result).model_dump(by_alias=True)

    _ensure_legacy_mode()
    return await _forward_post("/api/spc/chart-data", body.model_dump(by_alias=False, exclude_none=True), x_forwarded_access_token)


# ---------------------------------------------------------------------------
# Native Databricks route — slice 1 (subgroups)
# ---------------------------------------------------------------------------

_P999_SENTINEL = "P999"


_MAX_DATE_WINDOW_DAYS = 730


@router.get("/spc/subgroups", response_model=SPCSubgroupResponse)
async def spc_subgroups(
    material_id: Annotated[str, Query(..., min_length=1, description="SAP material number")],
    plant_id: Annotated[str, Query(..., min_length=1, description="Plant ID")],
    mic_id: Annotated[str, Query(..., min_length=1, description="MIC / characteristic ID")],
    operation_id: Annotated[str, Query(..., min_length=1, description="Sequential inspection-operation ID (not SAP work centre)")],
    date_from: _date = Query(..., description="Start date inclusive (YYYY-MM-DD)"),
    date_to: _date = Query(..., description="End date inclusive (YYYY-MM-DD)"),
    limit: int = Query(default=100, ge=1, description="Max subgroups to return"),
    response: Response = None,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
    x_databricks_catalog: str | None = Header(default=None),
) -> SPCSubgroupResponse:
    """SPC subgroup chart data — databricks-api mode only (slice 1, 2026-05-22).

    Returns aggregated subgroup points from spc_quality_metric_subgroup_mv.
    Filters on material/plant/MIC/operation and date range before returning.
    Max 200 subgroups per request. Max date window 730 days.

    Capability (Cp/Cpk/Pp/Ppk): unavailable — not in source MV.
    Nelson stored flags: unavailable — spc_nelson_rule_flags_mv absent in UAT.
    Signals: client-side only — frontend must calculate Nelson rule violations.
    Locked limits: deferred to slice 2.

    Browser UAT: pending. Production readiness: blocked.

    P999 sentinel plant rejected with 422. Legacy-api mode returns 503.
    Blank filter values, invalid dates, inverted date range, and date windows
    exceeding 730 days are rejected with 422.
    """
    if date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must be on or before date_to.")
    if (date_to - date_from).days > _MAX_DATE_WINDOW_DAYS:
        raise HTTPException(
            status_code=422,
            detail=f"Date window exceeds maximum of {_MAX_DATE_WINDOW_DAYS} days. "
                   "Narrow the date range to prevent broad scans of the source MV.",
        )

    mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="GET /spc/subgroups is only available in databricks-api mode. "
                   "Set BACKEND_ADAPTER_MODE=databricks-api.",
        )

    if plant_id == _P999_SENTINEL:
        raise HTTPException(status_code=422, detail="P999 is a test sentinel and cannot be used in production queries.")

    clamped_limit = max(1, min(limit, MAX_SUBGROUPS))

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token,
        x_forwarded_user,
        x_forwarded_email,
        x_databricks_catalog,
    )

    request = SubgroupsRequest(
        material_id=material_id,
        plant_id=plant_id,
        mic_id=mic_id,
        operation_id=operation_id,
        date_from=date_from.isoformat(),
        date_to=date_to.isoformat(),
        limit=clamped_limit,
    )

    subgroups_repository = SpcSubgroupsRepository(
        build_databricks_repository(identity, host, warehouse_id)
    )
    rows, spec = await run_repository_fetch(
        lambda: subgroups_repository.fetch_subgroups(request)
    )
    set_databricks_response_headers(response, spec)

    result = map_spc_subgroup_rows(rows, request)
    return SPCSubgroupResponse.model_validate(result)


# ---------------------------------------------------------------------------
# Internal guard
# ---------------------------------------------------------------------------


def _ensure_legacy_mode() -> None:
    """Raise 503 if BACKEND_ADAPTER_MODE is not legacy-api (or unset).

    databricks-api mode support: GET /spc/subgroups is now implemented.
    All other SPC routes still return 503 in databricks-api mode.
    """
    mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if mode == "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="SPC in databricks-api mode is not yet implemented for this route. "
                   "Set BACKEND_ADAPTER_MODE=legacy-api and configure V1_SPC_API_BASE_URL.",
        )
