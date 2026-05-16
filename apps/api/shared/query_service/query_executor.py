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
