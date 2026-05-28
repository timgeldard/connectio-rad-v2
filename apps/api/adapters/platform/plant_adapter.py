"""Platform-wide plant directory adapter.

Reads ``gold.gold_plant`` once for the whole app and powers the cross-workspace
plant picker. Unity Catalog enforces per-user plant visibility — this query
returns only the rows the authenticated user is entitled to see.

DNU plants (``PLANT_NAME LIKE '%DNU%'``) are excluded server-side. Results are
sorted by ``PLANT_ID`` for stable client ordering.

Resolution: ``${TRACE_CATALOG}.gold.gold_plant``. The ``envmon`` domain is used
as the resolver key because envmon already shares TRACE_CATALOG and the picker
mounts in the same shell that hosts envmon.
"""
from __future__ import annotations

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_executor import DatabricksRepository
from shared.query_service.query_spec import QuerySpec


def map_platform_plants_rows(rows: list[dict]) -> dict:
    plants = [
        {
            "plantId": str(row.get("plant_id", "")),
            "plantName": str(row.get("plant_name", "")),
        }
        for row in rows
        if row.get("plant_id")
    ]
    return {"plants": plants}


def get_platform_plants_spec() -> QuerySpec:
    """Return a QuerySpec for the platform plant directory.

    Source: ``${TRACE_CATALOG}.gold.gold_plant`` (envmon resolver key shares
    TRACE_CATALOG). Excludes ``DNU`` plants by name match. Ordered by PLANT_ID.
    Cache: GLOBAL_300S — plant list is a slow-moving dimension shared across
    users.
    """
    plant_table = resolve_domain_object("envmon", "gold_plant", schema_override="gold")

    sql = f"""
    SELECT
        PLANT_ID   AS plant_id,
        PLANT_NAME AS plant_name
    FROM {plant_table}
    WHERE PLANT_ID IS NOT NULL
      AND UPPER(PLANT_NAME) NOT LIKE '%DNU%'
    ORDER BY PLANT_ID
    """

    return QuerySpec(
        name="platform.get_plants",
        module="platform",
        endpoint="/api/platform/plants",
        sql=sql,
        params={},
        cache_policy=CacheTier.GLOBAL_300S,
        tags=["platform", "plants"],
    )


class PlatformPlantsRepository:
    """Repository for the cross-workspace plant directory."""

    def __init__(self, repository: DatabricksRepository) -> None:
        self._repository = repository

    async def fetch_plants(self) -> tuple[dict, QuerySpec]:
        return await self._repository.fetch(
            spec_factory=get_platform_plants_spec,
            mapper=map_platform_plants_rows,
        )
