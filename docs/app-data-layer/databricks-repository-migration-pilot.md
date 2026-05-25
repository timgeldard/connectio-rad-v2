# DatabricksRepository Migration Pilot

## Scope

This pilot migrates one read-only adapter group:

- `POST /api/quality/read-only-evidence`
- `apps/api/adapters/quality/quality_databricks_adapter.py`

The route contract and response body stay unchanged. The route still validates
request shape, mode, and required identifiers. The migrated adapter now owns
Databricks QuerySpec creation, repository execution, and row-to-contract
mapping through `QualityUsageDecisionRepository`.

## What Changed

- Quality usage-decision evidence now uses a domain repository wrapper over the
  shared `DatabricksRepository`.
- The shared route helper exposes repository construction and repository fetch
  error translation.
- The Quality route sets the standard Databricks response headers from the
  returned `QuerySpec`.
- Tests cover route-level auth, config, timeout, rate limit, permission,
  warehouse config, query-error behavior, response headers, and catalog override
  isolation.

## What Stayed Unchanged

- No SQL semantics changed.
- No data contracts changed.
- No generated contracts changed.
- No frontend panels changed.
- No caching was introduced.
- No live Databricks calls were added.

## Connection Lifecycle Decision

The repository path uses app-lifecycle-owned Databricks HTTP client pooling.

`DatabricksHttpClientPool` owns reusable `httpx.AsyncClient` instances keyed by
normalized Databricks host and statement timeout. The key is intentionally
bounded; OAuth tokens are passed per request and are never stored in the pooled
client. `StatementApiDatabricksClient` receives the pool through injection or
uses the module-level app pool.

FastAPI shutdown closes the app-level pool through the application lifespan
hook. Pool close is idempotent, clears all managed clients, and later requests
can safely create fresh clients rather than reusing a closed instance.

Tests cover:

- reusing the same client for the same host and timeout
- creating separate clients for different timeouts
- closing all managed clients
- idempotent close behavior
- recreating a client when a cached client is closed
- timeout and HTTP error paths keeping ownership with the pool until close
- FastAPI lifespan shutdown calling pool close

Out of scope: connection-pool sizing, retry policy redesign, catalog
allowlisting, caching, and live Databricks verification.

## Standard Error Behaviors

Future repository-backed routes should preserve this mapping:

- missing Databricks host or warehouse config -> HTTP 503
- missing user OAuth token -> HTTP 401
- missing Unity Catalog config -> HTTP 503
- Unity Catalog permission failure -> HTTP 403
- rate limit -> HTTP 429
- query timeout or cancellation -> HTTP 504
- SQL/query execution failure -> HTTP 502 with SQL details kept server-side

## Pattern For Next Adapters

1. Keep request validation and response assembly in the route.
2. Add a small domain repository wrapper that accepts the shared
   `DatabricksRepository`.
3. Move QuerySpec creation, execution, and row mapping into that wrapper.
4. Return `(mapped_result, QuerySpec)` so routes can set standard response
   headers.
5. Add tests for auth, config, timeout, rate limit, permission, query errors,
   response headers, and catalog override isolation.
6. Keep SQL, contracts, and frontend behavior unchanged unless the adapter
   migration itself reveals a blocking bug.

## Remaining Blockers Before Broad Migration

- Catalog overrides need production allowlisting before production-like flows.
- Retry semantics should be reviewed so total attempts and retries are named
  distinctly.
- Caching requires an ADR before implementation and must be tied to freshness
  policy.
- Warehouse 360 and Trace Investigation should wait until this pattern and the
  connection lifecycle are stable.
