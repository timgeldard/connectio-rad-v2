"""EnvMon Databricks-api adapter — QuerySpec factories and row mappers.

QuerySpec-only skeleton — NO ROUTE WIRED.
Implement routes only after DDL verification in connected_plant_uat.

Implemented slices:
  - get_site_summary_spec / map_site_summary_rows  (QuerySpec only — no route)

Column verification status (k.txt, 2026-05-17):
  All columns are confirmed-v1 (recovered from V1 ConnectIO-RAD source code and
  ai-context/semantic-model/entities.yaml). DDL not yet run on connected_plant_uat.

  gold_inspection_lot (TRACE_CATALOG / TRACE_SCHEMA):
    Confirmed-v1: INSPECTION_LOT_ID, PLANT_ID, INSPECTION_TYPE, CREATED_DATE
    Evidence: V1 em_config.py (table reference) + entities.yaml (columns) + plants.py (SQL)

  gold_inspection_point (TRACE_CATALOG / TRACE_SCHEMA):
    Confirmed-v1: INSPECTION_LOT_ID (FK), INSPECTION_POINT_ID, FUNCTIONAL_LOCATION,
                  OPERATION_ID, SAMPLE_ID
    Evidence: entities.yaml (columns) + V1 plants.py (join keys in fetch_plant_kpis)

  gold_batch_quality_result_v (TRACE_CATALOG / TRACE_SCHEMA):
    Confirmed-v1: INSPECTION_LOT_ID, OPERATION_ID, SAMPLE_ID (join keys),
                  MIC_NAME, QUANTITATIVE_RESULT, INSPECTION_RESULT_VALUATION,
                  UPPER_TOLERANCE, LOWER_TOLERANCE
    Evidence: entities.yaml (non-key columns) + V1 plants.py (join keys recovered
              from LEFT JOIN clause: ip.INSPECTION_LOT_ID, ip.OPERATION_ID, ip.SAMPLE_ID)

  Inspection type filter (confirmed-v1 from V1 em_config.py):
    INSPECTION_TYPE IN ('14', 'Z14')
    Type 14 = recurring environmental inspection; Z14 = customer extension

  INSPECTION_RESULT_VALUATION → result category mapping (confirmed-v1 from V1 DAL):
    'R' / 'REJ' / 'REJECT' → fail (active_fail)
    'W' / 'WARN'           → warning
    NULL                   → pending (no usage decision yet)
    other (e.g. 'A')       → pass

  DDL to run before wiring a route (replace <schema> with TRACE_SCHEMA value, default 'gold'):
    DESCRIBE TABLE connected_plant_uat.<schema>.gold_inspection_lot;
    DESCRIBE TABLE connected_plant_uat.<schema>.gold_inspection_point;
    DESCRIBE TABLE connected_plant_uat.<schema>.gold_batch_quality_result_v;
    SELECT DISTINCT INSPECTION_TYPE FROM connected_plant_uat.<schema>.gold_inspection_lot;
    SELECT DISTINCT INSPECTION_RESULT_VALUATION
      FROM connected_plant_uat.<schema>.gold_batch_quality_result_v LIMIT 50;

  Site summary partial coverage — fields not available from the V1 KPI query:
    criticalZoneExposures — needs zone/area-type join (requires em_location_zones or
                            equivalent; app-managed table, may not exist in connected_plant_uat)
    openCorrectiveActions — no CAPA source identified in gold layer
    trendDirection        — needs period-over-period comparison; deferred
  These return default values in map_site_summary_rows until source is confirmed.
"""
from __future__ import annotations

from dataclasses import dataclass

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

# ---------------------------------------------------------------------------
# Inspection type constants — confirmed-v1 from em_config.py
# Do not modify without V1 evidence or UAT DDL confirmation.
# ---------------------------------------------------------------------------
_ENVMON_INSPECTION_TYPES = ("'14'", "'Z14'")
_INSPECTION_TYPE_SQL = f"({', '.join(_ENVMON_INSPECTION_TYPES)})"

# ---------------------------------------------------------------------------
# Valuation → category mapping — confirmed-v1 from V1 DAL (plants.py)
# Used in map_site_summary_rows to classify loc_status.
# ---------------------------------------------------------------------------
_FAIL_VALUATIONS = frozenset(("R", "REJ", "REJECT"))
_WARN_VALUATIONS = frozenset(("W", "WARN"))


@dataclass
class SiteSummaryRequest:
    plant_id: str
    period_start: str
    period_end: str


def get_site_summary_spec(request: SiteSummaryRequest) -> QuerySpec:
    """Return a QuerySpec for getEnvMonSiteSummary.

    Source views:
      gold_inspection_lot    — lot header; INSPECTION_TYPE IN ('14','Z14') filter
      gold_inspection_point  — inspection/sample points with FUNCTIONAL_LOCATION
      gold_batch_quality_result_v — MIC results with INSPECTION_RESULT_VALUATION

    All three views use TRACE_CATALOG / TRACE_SCHEMA (confirmed-v1 from V1 em_config.py).
    Domain key "envmon" maps to TRACE_CATALOG / TRACE_SCHEMA in object_resolver.py.

    Contract: EnvMonSiteSummary (packages/data-contracts — environmental-monitoring.ts)
    Cache: PER_USER_60S — inspection results change as lots are closed.

    Column names: confirmed-v1 (not confirmed-ddl). Run DDL before wiring a route.
    Join keys (confirmed-v1 from V1 plants.py fetch_plant_kpis):
      lot → point:  INSPECTION_LOT_ID
      point → result: INSPECTION_LOT_ID + OPERATION_ID + SAMPLE_ID

    SQL adapted from V1 plants.py fetch_plant_kpis (ConnectIO-RAD, 2026-05-17).
    Changed: replaced -{days} lookback with explicit :period_start / :period_end params.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    lot_view = resolve_domain_object("envmon", "gold_inspection_lot")
    point_view = resolve_domain_object("envmon", "gold_inspection_point")
    result_view = resolve_domain_object("envmon", "gold_batch_quality_result_v")

    sql = f"""
    WITH base AS (
        SELECT
            ip.FUNCTIONAL_LOCATION        AS func_loc_id,
            r.INSPECTION_RESULT_VALUATION AS valuation,
            lot.INSPECTION_LOT_ID         AS lot_id
        FROM {lot_view} lot
        JOIN {point_view} ip
            ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        LEFT JOIN {result_view} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID = :plant_id
          AND lot.INSPECTION_TYPE IN {_INSPECTION_TYPE_SQL}
          AND ip.FUNCTIONAL_LOCATION IS NOT NULL
          AND lot.CREATED_DATE >= :period_start
          AND lot.CREATED_DATE <= :period_end
    ),
    loc_status AS (
        SELECT
            func_loc_id,
            MAX(CASE WHEN valuation IN ('R','REJ','REJECT') THEN 1 ELSE 0 END) AS is_fail,
            MAX(CASE WHEN valuation IN ('W','WARN')         THEN 1 ELSE 0 END) AS is_warn,
            MAX(CASE WHEN valuation IS NULL                 THEN 1 ELSE 0 END) AS is_pending,
            COUNT(DISTINCT lot_id)                                              AS lot_count
        FROM base
        GROUP BY func_loc_id
    )
    SELECT
        COUNT(*)                                                                          AS total_locs,
        SUM(CASE WHEN is_fail = 1 THEN 1 ELSE 0 END)                                    AS active_fails,
        SUM(CASE WHEN is_warn = 1 THEN 1 ELSE 0 END)                                    AS warnings,
        SUM(CASE WHEN is_pending = 1 THEN 1 ELSE 0 END)                                 AS pending,
        SUM(CASE WHEN is_fail = 0 AND is_warn = 0 AND is_pending = 0 THEN 1 ELSE 0 END) AS pass_locs,
        SUM(lot_count)                                                                   AS lots_tested
    FROM loc_status
    LIMIT :max_rows
    """

    return QuerySpec(
        name="envmon.get_site_summary",
        module="envmon",
        endpoint="/api/envmon/site-summary",
        sql=sql,
        params={
            "plant_id": request.plant_id,
            "period_start": request.period_start,
            "period_end": request.period_end,
        },
        cache_policy=CacheTier.PER_USER_60S,
        tags=["envmon", "site-summary", "kpi"],
    )


def map_site_summary_rows(rows: list[dict], plant_id: str) -> dict:
    """Map raw Databricks rows to the EnvMonSiteSummary contract shape.

    Field coverage (k.txt, 2026-05-17):
      Available from V1 KPI query:
        totalSamples     ← lots_tested (inspection lots = sampling events)
        positiveSamples  ← active_fails (locations with ≥1 FAIL valuation)
        positiveRate     ← computed: active_fails / total_locs (location-level rate)

      TEMPORARY CONTRACT PLACEHOLDERS — NOT FACTUAL BUSINESS VALUES:
        criticalZoneExposures → 0
          Source: requires em_location_zones zone classification join.
          em_location_zones is an app-managed table (confirmed-v1 from V1 migrations)
          that may not exist in connected_plant_uat. Do not treat 0 as "no exposures".
        openCorrectiveActions → 0
          Source: CAPA/corrective actions do not exist in V1 EnvMon at all — no tables,
          no routes, no code. There is no SAP QM or gold-layer source for this field.
          Do not treat 0 as "no open actions".
        trendDirection → "stable"
          Source: requires period-over-period rate comparison. Not implemented.
          "stable" is a schema default, not a calculated business signal.

    Note: positiveRate is per-location (fraction of locations with a fail), not
    per-sample. This matches V1 KPI semantics. Update when swab-result-level
    query is available.

    Returns default shape if rows is empty (no data for plant/period).
    """
    if not rows:
        return _default_site_summary(plant_id)

    row = rows[0]
    total_locs = int(row.get("total_locs") or 0)
    active_fails = int(row.get("active_fails") or 0)
    lots_tested = int(row.get("lots_tested") or 0)

    positive_rate = round(active_fails / total_locs, 4) if total_locs > 0 else 0.0

    return {
        "plantId": plant_id,
        "totalSamples": lots_tested,
        "positiveSamples": active_fails,
        "positiveRate": positive_rate,
        # TEMPORARY PLACEHOLDER — not a business fact. Source: em_location_zones (may not exist in UAT)
        "criticalZoneExposures": 0,
        # TEMPORARY PLACEHOLDER — not a business fact. Source: CAPA not present in V1 EnvMon
        "openCorrectiveActions": 0,
        # TEMPORARY PLACEHOLDER — not a business fact. Source: period-over-period comparison not implemented
        "trendDirection": "stable",
    }


def _default_site_summary(plant_id: str) -> dict:
    return {
        "plantId": plant_id,
        "totalSamples": 0,
        "positiveSamples": 0,
        "positiveRate": 0.0,
        # TEMPORARY PLACEHOLDER — not a business fact. Source: em_location_zones (may not exist in UAT)
        "criticalZoneExposures": 0,
        # TEMPORARY PLACEHOLDER — not a business fact. Source: CAPA not present in V1 EnvMon
        "openCorrectiveActions": 0,
        # TEMPORARY PLACEHOLDER — not a business fact. Source: period-over-period comparison not implemented
        "trendDirection": "stable",
    }
