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

IMPORTANT: All SQL column names below are unverified. They are inferred from SAP
T001W (plant master) naming conventions. Every column alias is marked with a TODO
comment. Do not remove TODOs until confirmed against the live table DDL.
"""
from __future__ import annotations

from shared.query_service.cache_policy import CacheTier
from shared.query_service.query_spec import QuerySpec


def map_lab_plants_rows(rows: list[dict]) -> dict:
    """Map raw Databricks rows to the ConnectedQualityLabPlantsResponse contract shape.

    Returns ``{"plants": [...]}`` always — empty list if no rows.

    Mapping: ``plant_id`` → ``plantId``, ``plant_name`` → ``plantName``.
    Column names are SQL aliases from ``get_lab_plants_spec`` — both are TODO-marked
    and must be verified against the live gold_plant table before production use.
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

    Source table: gold_plant (connected_plant_uat)
    Contract: ConnectedQualityLabPlantsResponseSchema (packages/data-contracts)
    Cache: GLOBAL_300S — plant list is a slow-moving dimension; shared across users.
    """
    sql = """
    SELECT
        werks  AS plant_id,    -- TODO: verify column name (SAP T001W.WERKS; may be plant_id in gold view)
        name1  AS plant_name   -- TODO: verify column name (SAP T001W.NAME1; may be plant_name in gold view)
    FROM gold_plant
    ORDER BY werks
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
