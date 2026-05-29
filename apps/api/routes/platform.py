"""Platform-wide endpoints used across workspaces.

Currently exposes the plant directory that powers the cross-workspace plant
picker. Future cross-workspace dimensions (lines, materials) would land here.

databricks-api only — no legacy-api fallback. Unity Catalog enforces per-user
plant visibility via OAuth-as-user.
"""
from __future__ import annotations

from fastapi import APIRouter, Header, Response

from adapters.platform.plant_adapter import PlatformPlantsRepository
from routes._databricks import (
    build_databricks_repository,
    build_user_identity,
    require_databricks_config,
    run_repository_fetch,
    set_databricks_response_headers,
)


router = APIRouter()


@router.get("/platform/plants")
async def platform_plants(
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
    x_databricks_catalog: str | None = Header(default=None),
):
    """Return the cross-workspace plant directory.

    Reads ``${TRACE_CATALOG}.gold.gold_plant`` filtered to exclude DNU plants,
    ordered by plant code. Unity Catalog enforces row-level visibility.
    """
    databricks_host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token,
        x_forwarded_user,
        x_forwarded_email,
        x_databricks_catalog,
    )
    repository = build_databricks_repository(identity, databricks_host, warehouse_id)
    platform_repo = PlatformPlantsRepository(repository)
    result, spec = await run_repository_fetch(platform_repo.fetch_plants)
    set_databricks_response_headers(response, spec)
    return result
