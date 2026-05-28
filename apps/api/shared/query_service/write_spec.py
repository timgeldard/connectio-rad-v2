"""WriteSpec — describes a single Databricks SQL write (INSERT/MERGE/DELETE).

Distinct from ``QuerySpec`` because writes must never be cached, must not
expose row data via ``LIMIT :max_rows``, and have a different observability
fingerprint (DML, not SELECT).

Every WriteSpec is required to stamp ``updated_by = CURRENT_USER()`` and
``updated_at = CURRENT_TIMESTAMP()`` in its SQL — the runtime asserts this so
that we cannot forget audit fields. Use either the literal column names above
or pass them via the params dict (``:updated_by`` / ``:updated_at``).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class WriteSpec:
    """Describes a single parameterised Databricks DML statement.

    Attributes:
        name: Dot-qualified identifier, e.g. ``"envmon.upsert_sub_area"``.
        module: Domain module name, e.g. ``"envmon"``.
        endpoint: The FastAPI route this spec backs, e.g. ``"/api/envmon/sub-areas"``.
        sql: Parameterised SQL using ``:param`` placeholders. Must be DML
            (INSERT, MERGE, UPDATE, DELETE) and must reference
            ``CURRENT_USER()`` and ``CURRENT_TIMESTAMP()`` for audit fields
            (asserted at runtime).
        params: Bind parameters keyed by placeholder name. Never embed
            user-supplied values directly in the SQL string.
        source_badge: Source badge written to ``AdapterWriteResult.source``.
        catalog_override: Override Unity Catalog name.
        schema_override: Override schema name within the catalog.
        timeout_seconds: Statement-level timeout forwarded to the client.
        tags: Arbitrary string tags for observability / query-tagging.
    """

    name: str
    module: str
    endpoint: str
    sql: str
    params: dict = field(default_factory=dict)
    source_badge: str = "databricks-api"
    catalog_override: Optional[str] = None
    schema_override: Optional[str] = None
    timeout_seconds: int = 60
    tags: list[str] = field(default_factory=list)


_AUDIT_TOKENS = ("CURRENT_USER()", "CURRENT_TIMESTAMP()")


def assert_write_spec_has_audit(spec: WriteSpec) -> None:
    """Raise if a WriteSpec is missing the required audit fields in its SQL.

    Architectural invariant: every V2 write stamps the acting user and the
    server timestamp. Detection is intentionally simple — we look for the SQL
    function call tokens. False negatives (writes that omit one) are caught
    immediately at request time; false positives (e.g. a comment mentioning
    the function) are accepted as cheap.

    Raises:
        ValueError: if either audit token is missing from ``spec.sql``.
    """
    sql_upper = spec.sql.upper()
    missing = [tok for tok in _AUDIT_TOKENS if tok not in sql_upper]
    if missing:
        raise ValueError(
            f"WriteSpec {spec.name!r} is missing required audit tokens: "
            f"{', '.join(missing)}. Every V2 write must stamp the acting user "
            "and the server timestamp."
        )
