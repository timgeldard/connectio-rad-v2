"""Databricks query-service error types — ADR-024 §4."""


class DatabricksAuthRequiredError(Exception):
    """Raised when a user OAuth token is required but not available.

    Per ADR-024 security rule: production Databricks reads must use the
    authenticated user's OAuth identity. Service-principal fallback is not
    permitted for user-facing reads.
    """

    def __init__(self, user_id: str) -> None:
        super().__init__(
            f"Databricks OAuth token required but not available for user {user_id!r}. "
            "Do not fall back to a service principal."
        )
        self.user_id = user_id


class QueryExecutionError(Exception):
    """Raised when a Databricks SQL query fails during execution."""


class DatabricksQueryTimeoutError(Exception):
    """Raised when a Databricks statement is cancelled due to timeout."""

    def __init__(self, query_name: str) -> None:
        super().__init__(f"Databricks query {query_name!r} timed out or was cancelled.")
        self.query_name = query_name


class DatabricksQueryError(Exception):
    """Raised when a Databricks statement execution fails (FAILED state or HTTP error)."""

    def __init__(self, query_name: str, detail: str) -> None:
        super().__init__(f"Databricks query {query_name!r} failed: {detail}")
        self.query_name = query_name
        self.detail = detail


class DatabricksConfigError(Exception):
    """Raised when required Databricks configuration environment variables are missing."""

    def __init__(self, missing_vars: list[str]) -> None:
        super().__init__(
            f"Databricks configuration incomplete. Missing: {', '.join(missing_vars)}. "
            "Set DATABRICKS_HOST and SQL_WAREHOUSE_ID environment variables."
        )
        self.missing_vars = missing_vars
