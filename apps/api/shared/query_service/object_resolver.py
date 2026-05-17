"""Catalog/schema-aware SQL object resolution for native Databricks queries.

V1-compatible fallback chains (verified from ConnectIO-RAD source):
  CQ_CATALOG  → falls back to TRACE_CATALOG (CQ and Trace share a workspace)
  CQ_SCHEMA   → falls back to POH_SCHEMA, then "csm_process_order_history"
  POH_CATALOG → no fallback (empty string if unset)
  POH_SCHEMA  → defaults to "csm_process_order_history"
  TRACE_CATALOG → no fallback (empty string if unset)
  TRACE_SCHEMA  → defaults to "gold"
  ENVMON domain → shares TRACE_CATALOG / TRACE_SCHEMA (confirmed from V1 em_config.py:
    LOT_TBL_NAME, POINT_TBL_NAME, RESULT_TBL_NAME all use f"{TRACE_CATALOG}.{TRACE_SCHEMA}.*")

Object names passed to these functions must be code constants — never user-supplied
request parameters. Caller is responsible for this invariant.
"""
from __future__ import annotations

import os

from shared.query_service.errors import DatabricksConfigError

_CATALOG_ENV: dict[str, str] = {
    "poh": "POH_CATALOG",
    "cq": "CQ_CATALOG",
    "trace2": "TRACE_CATALOG",
    "envmon": "TRACE_CATALOG",
}

_SCHEMA_ENV: dict[str, tuple[str, str]] = {
    "poh": ("POH_SCHEMA", "csm_process_order_history"),
    "cq": ("CQ_SCHEMA", "csm_process_order_history"),
    "trace2": ("TRACE_SCHEMA", "gold"),
    "envmon": ("TRACE_SCHEMA", "gold"),
}


def quote_identifier(name: str) -> str:
    """Return a backtick-quoted SQL identifier (catalog, schema, or object name)."""
    return f"`{name}`"


def qualify_object(catalog: str, schema: str, object_name: str) -> str:
    """Return a fully-qualified backtick-quoted three-part object reference.

    Produces: `catalog`.`schema`.`object_name`
    """
    return f"`{catalog}`.`{schema}`.`{object_name}`"


def resolve_domain_object(
    domain: str,
    object_name: str,
    *,
    schema_override: str | None = None,
    catalog_override: str | None = None,
) -> str:
    """Return a fully-qualified backtick-quoted object reference for domain/object_name.

    Reads catalog and schema from domain-specific environment variables.
    Applies V1-compatible fallback chains. Raises DatabricksConfigError if the
    catalog cannot be resolved (missing env var and no override).

    Args:
        domain: One of "poh", "cq", "trace2", "envmon".
        object_name: Code constant — the table/view name without qualification.
            Must never be a user-supplied value.
        schema_override: When set, bypasses the schema env var (e.g., "gold" for
            CQ lab plants which always uses the gold schema regardless of CQ_SCHEMA).
        catalog_override: When set, bypasses the catalog env var.

    Returns:
        Fully-qualified reference: `` `catalog`.`schema`.`object_name` ``

    Raises:
        DatabricksConfigError: Catalog env var is unset and no override given.
        ValueError: Unknown domain.
    """
    if domain not in _CATALOG_ENV:
        raise ValueError(f"Unknown domain: {domain!r}. Known domains: {sorted(_CATALOG_ENV)}")

    catalog_env = _CATALOG_ENV[domain]
    catalog = catalog_override or os.getenv(catalog_env, "")

    # CQ_CATALOG falls back to TRACE_CATALOG (V1 behaviour — CQ and Trace share workspace)
    if not catalog and domain in ("cq", "envmon"):
        catalog = os.getenv("TRACE_CATALOG", "")

    if not catalog:
        fallback_note = " (or TRACE_CATALOG for cq/envmon domain)" if domain in ("cq", "envmon") else ""
        raise DatabricksConfigError(
            [catalog_env],
            detail=(
                f"Missing Unity Catalog identifier for domain {domain!r}. "
                f"Set {catalog_env}{fallback_note}."
            ),
        )

    schema_env, schema_default = _SCHEMA_ENV[domain]
    schema = schema_override or os.getenv(schema_env, schema_default)

    return qualify_object(catalog, schema, object_name)
