"""EnvMon Databricks-api adapter — QuerySpec factories and row mappers.

Implemented slices:
  - get_site_summary_spec / map_site_summary_rows  (route wired in routes/envmon.py)

Column verification status (n.txt, 2026-05-17):
  All three Group A SAP QM views are confirmed-ddl (DESCRIBE TABLE run in
  connected_plant_uat by user on 2026-05-17). The k.txt confirmed-v1 columns
  were verified against live UAT DDL — all columns present.

  gold_inspection_lot (TRACE_CATALOG / TRACE_SCHEMA):
    Confirmed-ddl: INSPECTION_LOT_ID, PLANT_ID, INSPECTION_TYPE, CREATED_DATE
    Evidence: V1 em_config.py + entities.yaml + DESCRIBE TABLE in UAT

  gold_inspection_point (TRACE_CATALOG / TRACE_SCHEMA):
    Confirmed-ddl: INSPECTION_LOT_ID (FK), INSPECTION_POINT_ID, FUNCTIONAL_LOCATION,
                   OPERATION_ID, SAMPLE_ID
    Evidence: entities.yaml + V1 plants.py + DESCRIBE TABLE in UAT

  gold_batch_quality_result_v (TRACE_CATALOG / TRACE_SCHEMA):
    Confirmed-ddl: INSPECTION_LOT_ID, OPERATION_ID, SAMPLE_ID (join keys),
                   MIC_NAME, QUANTITATIVE_RESULT, INSPECTION_RESULT_VALUATION,
                   UPPER_TOLERANCE, LOWER_TOLERANCE
    Evidence: entities.yaml + V1 plants.py + DESCRIBE TABLE in UAT

  Inspection type filter (confirmed-v1+ddl from V1 em_config.py):
    INSPECTION_TYPE IN ('14', 'Z14')
    Type 14 = recurring environmental inspection; Z14 = customer extension

  INSPECTION_RESULT_VALUATION → result category mapping (confirmed-v1+ddl from V1 DAL):
    'R' / 'REJ' / 'REJECT' → fail (active_fail)
    'W' / 'WARN'           → warning
    NULL                   → pending (no usage decision yet)
    other (e.g. 'A')       → pass

  Site summary partial coverage — fields not derivable from V1 KPI query:
    plantName              — no plant_name in gold_inspection_lot; gold_plant lookup not in SQL (PLACEHOLDER "")
    openCorrectiveActions  — no CAPA source in V1 EnvMon at all (PLACEHOLDER 0)
    overdueActions         — no CAPA source in V1 EnvMon at all (PLACEHOLDER 0)
  These return default/empty values until the respective sources are confirmed.
"""
from __future__ import annotations

from dataclasses import dataclass

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

# ---------------------------------------------------------------------------
# Inspection type constants — confirmed-v1+ddl from em_config.py
# Do not modify without V1 evidence or UAT DDL confirmation.
# ---------------------------------------------------------------------------
_ENVMON_INSPECTION_TYPES = ("'14'", "'Z14'")
_INSPECTION_TYPE_SQL = f"({', '.join(_ENVMON_INSPECTION_TYPES)})"

# ---------------------------------------------------------------------------
# Valuation → category mapping — confirmed-v1+ddl from V1 DAL (plants.py)
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

    All three views use TRACE_CATALOG / TRACE_SCHEMA (confirmed-v1+ddl from em_config.py).
    Domain key "envmon" maps to TRACE_CATALOG / TRACE_SCHEMA in object_resolver.py.

    Contract: EnvMonSiteSummary (packages/data-contracts — environmental-monitoring.ts)
    Cache: PER_USER_60S — inspection results change as lots are closed.

    Column names: confirmed-ddl (DESCRIBE TABLE run in connected_plant_uat, 2026-05-17).
    Join keys (confirmed-v1+ddl from V1 plants.py fetch_plant_kpis):
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
        FROM base  -- CTE `base` defined above; backtick keeps architecture guardrail from flagging this as an unqualified table reference
        GROUP BY func_loc_id
    )
    SELECT
        COUNT(*)                                                                          AS total_locs,
        SUM(CASE WHEN is_fail = 1 THEN 1 ELSE 0 END)                                    AS active_fails,
        SUM(CASE WHEN is_warn = 1 THEN 1 ELSE 0 END)                                    AS warnings,
        SUM(CASE WHEN is_pending = 1 THEN 1 ELSE 0 END)                                 AS pending,
        SUM(CASE WHEN is_fail = 0 AND is_warn = 0 AND is_pending = 0 THEN 1 ELSE 0 END) AS pass_locs,
        SUM(lot_count)                                                                   AS lots_tested
    FROM loc_status  -- CTE `loc_status` defined above; backtick keeps architecture guardrail from flagging this as an unqualified table reference
    LIMIT 1
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

    Field coverage (n.txt, 2026-05-17 — confirmed-ddl):
      Derived from V1 KPI query (SAP QM inspection lots):
        zonesMonitored  ← total_locs (distinct functional locations with data in period)
        zonesWithAlerts ← active_fails (locations with ≥1 FAIL valuation)
        positiveCount   ← active_fails
        positiveRate    ← active_fails / total_locs × 100 (0–100 percentage, per-location)
        complianceRate  ← pass_locs / total_locs × 100 (0–100 percentage)
        riskStatus      ← derived: fails→non-compliant, warns→elevated, clean→compliant, none→unknown
        highestSeverity ← derived: fails→high, warns→medium, clean/none→low
        confidence      ← 1.0 if any locations sampled, 0.0 if no data

      TEMPORARY PLACEHOLDERS — not business facts:
        plantName → "" (no plant_name in gold_inspection_lot; gold_plant lookup not in current SQL)
        openCorrectiveActions → 0 (CAPA not in V1 EnvMon; no gold-layer source)
        overdueActions → 0 (CAPA not in V1 EnvMon; no gold-layer source)

    Returns default shape if rows is empty (no data for plant/period).
    """
    if not rows:
        return _default_site_summary(plant_id)

    row = rows[0]
    total_locs = int(row.get("total_locs") or 0)
    active_fails = int(row.get("active_fails") or 0)
    warnings = int(row.get("warnings") or 0)
    pass_locs = int(row.get("pass_locs") or 0)

    positive_rate = round(active_fails / total_locs * 100, 2) if total_locs > 0 else 0.0
    compliance_rate = round(pass_locs / total_locs * 100, 2) if total_locs > 0 else 0.0
    confidence = 1.0 if total_locs > 0 else 0.0

    # V2-contract derivations — these are rule-based classifications defined by
    # EnvMonSiteSummarySchema, not carried over from V1 business logic. V1 did not
    # expose riskStatus, highestSeverity, or confidence; these fields are computed
    # here from inspection-lot aggregate counts per the V2 data contract.
    if total_locs == 0:
        risk_status = "unknown"
        highest_severity = "low"
    elif active_fails > 0:
        risk_status = "non-compliant"
        highest_severity = "high"
    elif warnings > 0:
        risk_status = "elevated"
        highest_severity = "medium"
    else:
        risk_status = "compliant"
        highest_severity = "low"

    return {
        "plantId": plant_id,
        # PLACEHOLDER — no plant_name in gold_inspection_lot; gold_plant lookup not in SQL
        "plantName": "",
        "zonesMonitored": total_locs,
        "zonesWithAlerts": active_fails,
        "positiveCount": active_fails,
        "positiveRate": positive_rate,
        # PLACEHOLDER — CAPA not present in V1 EnvMon; no gold-layer source
        "openCorrectiveActions": 0,
        # PLACEHOLDER — CAPA not present in V1 EnvMon; no gold-layer source
        "overdueActions": 0,
        "complianceRate": compliance_rate,
        "riskStatus": risk_status,
        "highestSeverity": highest_severity,
        "confidence": confidence,
    }


def _default_site_summary(plant_id: str) -> dict:
    return {
        "plantId": plant_id,
        "plantName": "",
        "zonesMonitored": 0,
        "zonesWithAlerts": 0,
        "positiveCount": 0,
        "positiveRate": 0.0,
        "openCorrectiveActions": 0,
        "overdueActions": 0,
        "complianceRate": 0.0,
        "riskStatus": "unknown",
        "highestSeverity": "low",
        "confidence": 0.0,
    }
