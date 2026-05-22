"""SPC Databricks-api adapter — QuerySpec factories and row mappers.

Implemented slices:
  - get_spc_subgroups_spec / map_spc_subgroup_rows  (route wired in routes/spc.py)

Column verification status (pp.txt, 2026-05-22 — UAT confirmed):
  spc_quality_metric_subgroup_mv (SPC_CATALOG / SPC_SCHEMA = "gold"):
    Confirmed-ddl (DESCRIBE TABLE run in connected_plant_uat, 2026-05-22):
      material_id   — material identifier (navigation key)
      plant_id      — plant identifier (P-prefix and C-prefix variants observed in UAT)
      mic_id        — MIC / characteristic identifier
      mic_name      — MIC name / characteristic name
      operation_id  — sequential inspection-operation identifier (NOT SAP work centre; see note)
      batch_id      — batch identifier
      batch_date    — batch date (DATE or TIMESTAMP column; cast to STRING in SQL)
      sum_value     — sum of measurement values in subgroup
      batch_n       — subgroup sample count
      batch_range   — range within subgroup (max - min)
      lsl_spec      — lower specification limit (0.0 sentinel = not populated — see note)
      usl_spec      — upper specification limit (0.0 sentinel = not populated — see note)

  MV grain: measurement-level (multiple rows per batch_id × batch_date).
  Subgroup aggregation: GROUP BY (batch_id, batch_date);
    subgroup_mean  = MAX(sum_value) / NULLIF(MAX(batch_n), 0)
    subgroup_range = MAX(batch_range)
    sample_count   = MAX(batch_n)

  operation_id note: Sequential inspection-operation identifier, NOT an SAP work-centre
    number. Do not surface as workCentreId in any response contract.

  Spec-limit sentinel (UAT observed 2026-05-22): lsl_spec=0.0 AND usl_spec=0.0 together
    indicates the spec limits were never populated. Both are mapped to null in the
    response to prevent clients from treating 0.0 as a real lower bound. A legitimate
    lsl of 0.0 would be accompanied by a non-zero usl (or vice-versa) and would not
    trigger this sentinel.

  Not yet confirmed (deferred to slice 2):
    spc_locked_limits columns — DESCRIBE TABLE not run; lockedLimits always null in slice 1.

  Unavailable (UAT confirmed — not in source):
    Cp / Cpk / Pp / Ppk — not a column in spc_quality_metric_subgroup_mv.
    Nelson stored rule flags — no spc_nelson_rule_flags_mv in UAT (pr #65 verified absent).
    Capability metrics — capabilityAvailable is Literal[False] in response contract.

SPC_CATALOG falls back to TRACE_CATALOG (same workspace). See object_resolver.py.

UAT candidate operation IDs (verified 2026-05-22, spc-databricks-verification-results-summary.md):
  pH   — material 20642328 / P523 / mic 0010 / operation_id 00000004  (spec limits 7.2/7.8)
  Salt — material 20047111 / C037 / mic 0060 / operation_id 00000001  (0.0 sentinel spec limits)

Point1 artefact (generated.py): datamodel-codegen generates an anonymous Point1 class for
SPCSubgroupResponse.points because export-json-schema.ts processes schemas in isolation and
emits the item schema inline rather than as a $ref to SPCSubgroupPoint. Runtime validation is
unaffected — Point1 is structurally identical to SPCSubgroupPoint.
"""
from __future__ import annotations

from dataclasses import dataclass

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

# Maximum subgroups returnable per request — prevents broad scans of the 73M-row MV.
# Route handler must clamp user-supplied limit to [1, MAX_SUBGROUPS] before calling.
MAX_SUBGROUPS = 200

_SPC_MV = "spc_quality_metric_subgroup_mv"


@dataclass
class SubgroupsRequest:
    material_id: str
    plant_id: str
    mic_id: str
    operation_id: str
    date_from: str  # inclusive, YYYY-MM-DD
    date_to: str    # inclusive, YYYY-MM-DD
    limit: int      # pre-clamped by route handler to [1, MAX_SUBGROUPS]


def get_spc_subgroups_spec(request: SubgroupsRequest) -> QuerySpec:
    """Return a QuerySpec for the SPC subgroups slice.

    Source view: spc_quality_metric_subgroup_mv (SPC_CATALOG / SPC_SCHEMA).
    Domain key "spc" maps to SPC_CATALOG (falls back to TRACE_CATALOG) /
    SPC_SCHEMA (defaults to "gold") in object_resolver.py.

    Aggregation: GROUP BY (batch_id, batch_date) — one row per subgroup.
      subgroup_mean  = MAX(sum_value) / NULLIF(MAX(batch_n), 0)
      subgroup_range = MAX(batch_range)
      sample_count   = MAX(batch_n)
      mic_name       = MAX(mic_name)  — same for all rows of a given mic_id
      lsl/usl_spec   = MAX(lsl_spec) / MAX(usl_spec)

    All five WHERE filters are required; limit is embedded as a validated integer
    literal. Route handler must clamp limit to [1, MAX_SUBGROUPS] before calling.

    Raises DatabricksConfigError if SPC_CATALOG and TRACE_CATALOG are both unset.
    """
    mv = resolve_domain_object("spc", _SPC_MV)

    sql = f"""
    SELECT
        batch_id,
        CAST(batch_date AS STRING)                       AS batch_date,
        MAX(sum_value) / NULLIF(MAX(batch_n), 0)         AS subgroup_mean,
        MAX(batch_range)                                 AS subgroup_range,
        MAX(batch_n)                                     AS sample_count,
        MAX(lsl_spec)                                    AS lsl_spec,
        MAX(usl_spec)                                    AS usl_spec,
        MAX(mic_name)                                    AS mic_name
    FROM {mv}
    WHERE material_id  = :material_id
      AND plant_id     = :plant_id
      AND mic_id       = :mic_id
      AND operation_id = :operation_id
      AND batch_date  >= :date_from
      AND batch_date  <= :date_to
    GROUP BY batch_id, batch_date
    ORDER BY batch_date DESC
    LIMIT {request.limit}
    """

    return QuerySpec(
        name="spc.get_subgroups",
        module="spc",
        endpoint="/api/spc/subgroups",
        sql=sql,
        params={
            "material_id": request.material_id,
            "plant_id": request.plant_id,
            "mic_id": request.mic_id,
            "operation_id": request.operation_id,
            "date_from": request.date_from,
            "date_to": request.date_to,
        },
        cache_policy=CacheTier.PER_USER_60S,
        tags=["spc", "subgroups", "chart-data"],
    )


def map_spc_subgroup_rows(rows: list[dict], request: SubgroupsRequest) -> dict:
    """Map raw Databricks rows to SPCSubgroupResponse contract shape.

    Field coverage (pp.txt, 2026-05-22 — source-verified):
      materialId            ← request.material_id (echo)
      plantId               ← request.plant_id (echo)
      micId                 ← request.mic_id (echo)
      micName               ← MAX(mic_name) from first aggregated row (nullable)
      operationId           ← request.operation_id (echo — sequential inspection op, NOT SAP WC)
      points[].batchId      ← batch_id (source-verified)
      points[].batchDate    ← batch_date cast to STRING (source-verified)
      points[].subgroupMean ← MAX(sum_value) / NULLIF(MAX(batch_n), 0) (source-verified)
      points[].subgroupRange← MAX(batch_range) (source-verified; nullable)
      points[].sampleCount  ← MAX(batch_n) (source-verified)
      points[].lslSpec      ← MAX(lsl_spec); null if 0.0 sentinel pair (source-verified)
      points[].uslSpec      ← MAX(usl_spec); null if 0.0 sentinel pair (source-verified)
      lockedLimits          ← None (slice 1: spc_locked_limits not confirmed; deferred)
      capabilityAvailable   ← False (Cp/Cpk/Pp/Ppk not available in UAT source)
      nelsonStoredFlagsAvailable ← False (spc_nelson_rule_flags_mv absent in UAT)
      signalsClientSideOnly ← True (no stored signal rows; client calculates Nelson rules)

    Empty rows returns a response with points=[].
    """
    mic_name: str | None = None
    points: list[dict] = []

    for row in rows:
        if mic_name is None:
            raw_name = row.get("mic_name")
            mic_name = str(raw_name) if raw_name is not None else None

        lsl = _parse_spec_limit(row.get("lsl_spec"))
        usl = _parse_spec_limit(row.get("usl_spec"))
        # Sentinel: both 0.0 means not populated in UAT — map pair to null.
        if lsl == 0.0 and usl == 0.0:
            lsl = None
            usl = None

        mean_raw = row.get("subgroup_mean")
        mean = float(mean_raw) if mean_raw is not None else 0.0

        points.append({
            "batchId": str(row.get("batch_id") or ""),
            "batchDate": str(row.get("batch_date") or ""),
            "subgroupMean": mean,
            "subgroupRange": _float_or_none(row.get("subgroup_range")),
            "sampleCount": max(1, int(row.get("sample_count") or 1)),
            "lslSpec": lsl,
            "uslSpec": usl,
        })

    return {
        "materialId": request.material_id,
        "plantId": request.plant_id,
        "micId": request.mic_id,
        "micName": mic_name,
        "operationId": request.operation_id,
        "points": points,
        "lockedLimits": None,
        "capabilityAvailable": False,
        "nelsonStoredFlagsAvailable": False,
        "signalsClientSideOnly": True,
    }


def _parse_spec_limit(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _float_or_none(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
