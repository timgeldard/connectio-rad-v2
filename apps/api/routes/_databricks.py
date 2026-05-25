"""Shared helpers for databricks-api route handlers.

Extracted here to avoid duplicating config checks and response-header logic
across the POH and CQ Lab routes. Keep this module minimal — do not add
business logic or SQL here.
"""
from __future__ import annotations

import logging
import os
from collections.abc import Callable

from fastapi import HTTPException, Response

_logger = logging.getLogger("connectio.databricks_routes")

from shared.query_service.databricks_client import StatementApiDatabricksClient
from shared.query_service.errors import (
    DatabricksAuthRequiredError,
    DatabricksConfigError,
    DatabricksPermissionError,
    DatabricksQueryError,
    DatabricksQueryTimeoutError,
    DatabricksRateLimitError,
    DatabricksWarehouseConfigError,
)
from shared.query_service.identity import UserIdentity
from shared.query_service.query_executor import QueryExecutor
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


def build_user_identity(
    token: str | None, user: str | None, email: str | None, catalog_target: str | None = None
) -> UserIdentity:
    """Construct a UserIdentity from forwarded OAuth headers."""
    return UserIdentity(
        user_id=user or "unknown",
        email=email,
        raw_oauth_token=token,
        catalog_target=catalog_target,
    )


async def run_query(
    spec_factory: Callable[[], QuerySpec],
    identity: UserIdentity,
    databricks_host: str,
    warehouse_id: str,
) -> tuple[list[dict], QuerySpec]:
    """Create a QuerySpec, execute it, and translate errors into HTTP exceptions.

    Accepts a zero-argument factory so that spec-creation errors (e.g.
    DatabricksConfigError from a missing catalog env var) are caught alongside
    execution errors and mapped to the appropriate HTTP status code.

    Returns (rows, spec) so the caller can set response headers from the spec.
    """
    from shared.query_service.query_executor import DatabricksRepository
    try:
        client = StatementApiDatabricksClient(host=databricks_host)
        executor = QueryExecutor(client=client, warehouse_id=warehouse_id)
        repository = DatabricksRepository(executor=executor, identity=identity)
        
        # We pass a simple lambda for the mapper since we just want the raw rows.
        # This keeps backwards compatibility with existing route handlers that map the rows themselves.
        rows, spec = await repository.fetch(
            spec_factory=spec_factory,
            mapper=lambda r: r
        )
        return rows, spec
    except DatabricksConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DatabricksAuthRequiredError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except DatabricksPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except DatabricksWarehouseConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DatabricksRateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except DatabricksQueryTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except DatabricksQueryError as exc:
        # Log the actual SQL error server-side so operators can diagnose UAT
        # blockers (missing columns, missing views). The client response stays
        # generic to avoid leaking SQL internals.
        _logger.error(
            "Databricks query %r failed: %s",
            getattr(exc, "query_name", "?"),
            getattr(exc, "detail", str(exc)),
        )
        raise HTTPException(status_code=502, detail="Databricks query execution failed") from exc
