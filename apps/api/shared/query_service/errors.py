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
