"""Shared helpers for databricks-api route handlers.

Extracted here to avoid duplicating config checks and response-header logic
across the POH and CQ Lab routes. Keep this module minimal — do not add
business logic or SQL here.
"""
from __future__ import annotations

import os

from fastapi import HTTPException, Response

from shared.query_service.query_spec import QuerySpec

_MISSING_CONFIG_DETAIL = (
    "DATABRICKS_HOST and SQL_WAREHOUSE_ID must be configured "
    "for BACKEND_ADAPTER_MODE=databricks-api"
)


def require_databricks_config() -> tuple[str, str]:
    """Return ``(databricks_host, warehouse_id)`` or raise HTTP 503.

    Reads ``DATABRICKS_HOST`` and ``SQL_WAREHOUSE_ID`` at call time so
    ``monkeypatch`` works correctly in tests.
    """
    host = os.getenv("DATABRICKS_HOST", "")
    warehouse_id = os.getenv("SQL_WAREHOUSE_ID", "")
    if not host or not warehouse_id:
        raise HTTPException(status_code=503, detail=_MISSING_CONFIG_DETAIL)
    return host, warehouse_id


def set_databricks_response_headers(response: Response, spec: QuerySpec) -> None:
    """Set standard observability headers on a successful databricks-api response."""
    response.headers["X-Data-Source"] = spec.source_badge
    response.headers["X-Adapter-Mode"] = "databricks-api"
    response.headers["X-Query-Name"] = spec.name
