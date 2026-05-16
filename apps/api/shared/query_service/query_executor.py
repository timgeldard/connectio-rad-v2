"""QueryExecutor — ADR-024 §3.

Executes a QuerySpec against Databricks using the authenticated user's OAuth
token. The actual Databricks client is injected to allow testing without a
live warehouse connection.

ADR-024 open questions that must be resolved before replacing
NotImplementedDatabricksClient with a real client:
  #1 — Statement API vs SQL Connector
  #7 — Cache backend (in-process LRU dict vs Redis/Lakebase)
"""
from __future__ import annotations

from .identity import UserIdentity
from .query_spec import QuerySpec


class NotImplementedDatabricksClient:
    """Placeholder — real implementation pending ADR-024 open questions #1 and #7."""

    def execute(self, spec: QuerySpec, token: str) -> list[dict]:
        raise NotImplementedError(
            "Databricks client not implemented. Resolve ADR-024 open questions "
            "#1 (Statement API vs SQL Connector) and #7 (cache backend) first, "
            "then replace NotImplementedDatabricksClient with a real client."
        )


class QueryExecutor:
    """Executes a QuerySpec against Databricks using the user's OAuth token.

    Enforces the identity constraint: ``execute()`` calls
    ``identity.require_user_oauth()`` before passing any query to the client.
    If the token is absent, ``DatabricksAuthRequiredError`` propagates to the
    caller — no service-principal fallback.
    """

    def __init__(self, client: object | None = None) -> None:
        self._client = client or NotImplementedDatabricksClient()

    def execute(self, spec: QuerySpec, identity: UserIdentity) -> list[dict]:
        """Execute spec with the user's OAuth token and return rows as list[dict].

        Raises:
            DatabricksAuthRequiredError: if ``identity.raw_oauth_token`` is absent.
            NotImplementedError: if the Databricks client is not yet implemented.
            QueryExecutionError: if the query fails during execution.
        """
        token = identity.require_user_oauth()
        return self._client.execute(spec, token)  # type: ignore[union-attr]
