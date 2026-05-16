"""QuerySpec/QueryExecutor infrastructure — ADR-024 §3."""
from .cache_policy import CacheTier
from .errors import DatabricksAuthRequiredError, QueryExecutionError
from .identity import UserIdentity
from .query_spec import QuerySpec
from .query_executor import QueryExecutor

__all__ = [
    "CacheTier",
    "DatabricksAuthRequiredError",
    "QueryExecutionError",
    "UserIdentity",
    "QuerySpec",
    "QueryExecutor",
]
