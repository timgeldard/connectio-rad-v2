"""QueryExecutor — ADR-024 §3, ADR-025.

Executes a QuerySpec against Databricks using the authenticated user's OAuth
token. The client is injected so tests can run without a live warehouse.

Security invariant: ``execute()`` calls ``identity.require_user_oauth()``
before passing the query to the client. If the token is absent,
``DatabricksAuthRequiredError`` propagates to the caller — no service-
principal fallback, no mock fallback.
"""
from __future__ import annotations

import logging

from .databricks_client import DatabricksQueryClient, NotImplementedDatabricksClient
from .errors import (
    DatabricksAuthRequiredError,
    DatabricksPermissionError,
    DatabricksQueryError,
    DatabricksQueryTimeoutError,
    DatabricksRateLimitError,
    DatabricksWarehouseConfigError,
)
from .identity import UserIdentity
from .query_spec import QuerySpec

_log = logging.getLogger(__name__)


class QueryExecutor:
    """Executes a QuerySpec against Databricks using the user's OAuth token.

    Args:
        client: Databricks query client. Defaults to ``NotImplementedDatabricksClient``
            when no real client is available yet.
        warehouse_id: SQL warehouse ID forwarded to the client on every call.
    """

    def __init__(
        self,
        client: DatabricksQueryClient | None = None,
        warehouse_id: str = "",
    ) -> None:
        self._client: DatabricksQueryClient = client or NotImplementedDatabricksClient()
        self._warehouse_id = warehouse_id

    async def execute(self, spec: QuerySpec, identity: UserIdentity) -> list[dict]:
        """Execute *spec* with the user's OAuth token and return rows as list[dict].

        Steps:
        1. Demand the OAuth token — raises ``DatabricksAuthRequiredError`` if absent.
        2. Merge ``spec.max_rows`` into params so ``LIMIT :max_rows`` is bound.
        3. Build a tags dict for observability.
        4. Delegate to the injected client.

        Raises:
            DatabricksAuthRequiredError: if ``identity.raw_oauth_token`` is absent.
            DatabricksQueryTimeoutError: if the client times out.
            DatabricksQueryError: if Databricks returns a FAILED state or HTTP error.
            NotImplementedError: if the client is ``NotImplementedDatabricksClient``.
        """
        token = identity.require_user_oauth()

        params: dict[str, object] = {**spec.params, "max_rows": spec.max_rows}

        tags: dict[str, str] = {
            "query_name": spec.name,
            "module": spec.module,
            "endpoint": spec.endpoint,
            "user_id": identity.user_id,
        }
        for t in spec.tags:
            tags[t] = "true"
        # Reserved keys written after spec.tags loop so they cannot be overridden by caller tags.
        tags["cache_policy"] = spec.cache_policy.value
        tags["source_badge"] = spec.source_badge

        _log.info(
            "QueryExecutor.execute",
            extra={"query_name": spec.name, "user_id": identity.user_id},
        )

        return await self._client.execute(
            sql=spec.sql,
            params=params,
            oauth_token=token,
            warehouse_id=self._warehouse_id,
            timeout_seconds=spec.timeout_seconds,
            tags=tags,
        )


import asyncio
from collections.abc import Callable
from typing import TypeVar, Any

T = TypeVar("T")

class DatabricksRepository:
    """Base repository class for executing queries and mapping results.

    Takes ownership of connection pooling, API error handling, retry backoff logic,
    and JSON-to-dict parsing.
    """

    def __init__(self, executor: QueryExecutor, identity: UserIdentity):
        self.executor = executor
        self.identity = identity

    async def fetch(
        self,
        spec_factory: Callable[[], QuerySpec],
        mapper: Callable[[list[dict[str, Any]]], T],
        max_retries: int = 3,
        base_backoff: float = 1.0,
    ) -> tuple[T, QuerySpec]:
        """Execute a QuerySpec and return mapped results, applying retry logic.

        Args:
            spec_factory: Zero-argument function returning a QuerySpec.
            mapper: Function that converts raw Databricks rows (list of dicts) into
                the target domain model.
            max_retries: Maximum number of times to retry a failed query.
            base_backoff: Base sleep time in seconds before retrying.

        Returns:
            A tuple of (mapped_result, query_spec) so callers can set HTTP headers.
        """
        # Execute spec_factory inside the loop so catalog env vars are evaluated
        # per attempt (e.g. if we switch context midway, though unlikely).
        last_error: Exception | None = None

        from shared.query_service.object_resolver import catalog_context
        token = catalog_context.set(self.identity.catalog_target)
        try:
            for attempt in range(max_retries):
                try:
                    spec = spec_factory()
                    rows = await self.executor.execute(spec, self.identity)
                    return mapper(rows), spec
                except (DatabricksQueryTimeoutError, DatabricksRateLimitError) as exc:
                    last_error = exc
                    if attempt < max_retries - 1:
                        sleep_time = base_backoff * (2 ** attempt)
                        _log.warning(
                            "Transient Databricks error on attempt %d: %s. Retrying in %.1fs...",
                            attempt + 1,
                            str(exc),
                            sleep_time,
                        )
                        await asyncio.sleep(sleep_time)
                except Exception as exc:
                    # Non-retriable errors (Auth required, Syntax error, config error)
                    raise exc

            # If we exhausted retries, raise the last transient error
            if last_error:
                raise last_error
            
            # Fallback (should be unreachable if max_retries > 0)
            raise RuntimeError("Exhausted retries without a clear error.")
        finally:
            catalog_context.reset(token)
