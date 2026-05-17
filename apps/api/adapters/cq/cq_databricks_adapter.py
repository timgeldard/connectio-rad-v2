"""CQ Lab Databricks-api adapter — QuerySpec factories for Connected Quality Lab.

Implemented slices:
  - get_lab_plants_spec: maps to ConnectedQualityLabPlantsResponseSchema

Deferred slices:
  - get_lab_failures_spec: BLOCKED — see docs/migration/cq-lab-databricks-blockers.md
    Reason: the `line` field in ConnectedQualityLabFailureSchema is z.string()
    (required). The only available source for production-line enrichment is
    vw_gold_process_order_plan, which does not exist in csm_process_order_history.
    Do not implement until that view is created.

Route wiring deferred: the existing proxy route GET /api/cq/lab/plants in
apps/api/routes/connected_quality_lab.py forwards to V1. Databricks route wiring
requires column names verified against live gold_plant table in connected_plant_uat.

Column name alignment: PLANT_ID / PLANT_NAME confirmed from V1 source
(apps/connectedquality/backend/connectedquality_backend/dal/lab.py — fetch_lab_plants).
Table qualification uses CQ_CATALOG + gold schema (V1 behaviour: gold.gold_plant).
"""
from __future__ import annotations

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec


def map_lab_plants_rows(rows: list[dict]) -> dict:
    """Map raw Databricks rows to the ConnectedQualityLabPlantsResponse contract shape.

    Returns ``{"plants": [...]}`` always — empty list if no rows.

    Mapping: ``plant_id`` → ``plantId``, ``plant_name`` → ``plantName``.
    Column names confirmed from V1 source (gold.gold_plant.PLANT_ID / PLANT_NAME).
    """
    plants = [
        {
            "plantId": str(row.get("plant_id", "")),
            "plantName": str(row.get("plant_name", "")),
        }
        for row in rows
        if row.get("plant_id")
    ]
    return {"plants": plants}


def get_lab_plants_spec() -> QuerySpec:
    """Return a QuerySpec for getLabPlants.

    Source table: gold.gold_plant under CQ_CATALOG (falls back to TRACE_CATALOG).
    Schema is always ``gold`` — matches V1 which uses `{CQ_CATALOG}`.`gold`.`gold_plant`.
    Contract: ConnectedQualityLabPlantsResponseSchema (packages/data-contracts)
    Cache: GLOBAL_300S — plant list is a slow-moving dimension; shared across users.

    Raises DatabricksConfigError if CQ_CATALOG (or fallback TRACE_CATALOG) is not set.
    """
    plant_table = resolve_domain_object("cq", "gold_plant", schema_override="gold")

    sql = f"""
    SELECT
        PLANT_ID   AS plant_id,    -- confirmed via V1 source: gold.gold_plant.PLANT_ID
        PLANT_NAME AS plant_name   -- confirmed via V1 source: gold.gold_plant.PLANT_NAME
    FROM {plant_table}
    WHERE PLANT_ID IS NOT NULL
    ORDER BY PLANT_ID
    LIMIT :max_rows
    """

    return QuerySpec(
        name="cq.get_lab_plants",
        module="cq",
        endpoint="/api/cq/lab/plants",
        sql=sql,
        params={},
        cache_policy=CacheTier.GLOBAL_300S,
        tags=["cq", "lab", "plants"],
    )
