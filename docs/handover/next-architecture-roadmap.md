# Next Architecture Roadmap

## Current Baseline

The current `main` baseline has completed a truthfulness and UAT-readiness
hardening wave across evidence-state UX, source-truthful wording, null handling,
regression coverage, offline UAT smoke checks, frontend panel/query decoupling,
and a move toward `nx affected` with backend-domain inputs.

This baseline is intentionally stronger for frontend/library feedback speed, but
backend, API, Databricks adapter, and generated-contract confidence should not
depend only on the Nx affected graph.

## What This CI PR Protects

PR 1, `ci: add explicit backend and contract guardrails alongside nx affected`,
keeps `nx affected` for frontend and library checks while adding explicit
backend and contract guardrails:

- backend import smoke check for `apps/api/main.py`
- Python backend tests under `apps/api/tests`
- `data-contracts` test and typecheck targets
- generated contract drift detection through `data-contracts:check-pydantic`

These checks run regardless of the affected project result because Python route
modules, Databricks adapters, and generated Pydantic contract artifacts are not
yet fully represented as first-class Nx project boundaries.

## High-Priority Next Workstreams

- TODO: Migrate domain adapters to `DatabricksRepository` incrementally by
  domain, with timeout, rate limit, permission, auth, and config error tests for
  each migrated group.
- TODO: Fix `DatabricksRepository` connection pooling lifecycle in a dedicated
  backend reliability PR. `AsyncClient` instances must be closed or owned by an
  app lifecycle hook, and connection ownership must be explicit.
- TODO: Define an ADR before implementing evidence-route caching. Caching must
  be tied to freshness policy, cache hit/miss/age must be visible in headers,
  stale cached evidence must not appear live, and decision-sensitive evidence
  must not be cached silently.
- TODO: Run focused Warehouse 360 and Trace Investigation UAT after CI and
  repository reliability are stable.

DatabricksRepository catalog overrides are allowlisted via
`DATABRICKS_ALLOWED_CATALOGS`; deployment-specific approved catalog values remain
environment configuration. Retry semantics must distinguish total attempts from
retries.

Focused UAT must use real browser/network capture when Databricks access is
available. Offline smoke checks do not count as live UAT evidence. Warehouse 360
overview Gates 4 and 5 remain blocked unless governed; Warehouse
inbound/staging/exceptions can be UAT candidates with caveats. Trace
Investigation must not imply automated recall decisions.

## Medium-Priority Next Workstreams

- TODO: Introduce workspace-level state management only after first-wave UAT
  pain points confirm the prop-drilling problem and target workspace.
- TODO: Deepen the design system with manufacturing-specific primitives after
  UAT identifies priority visuals, such as SPC charts, interactive lineage
  graphs, and batch timelines.
- TODO: Optimize Nx CI further after explicit backend safeguards are stable, so
  speed improvements do not hide backend or contract regressions.

## Deliberately Out Of Scope For PR 1

- full DatabricksRepository migration
- connection-pooling implementation
- caching implementation
- new workspace-level state management
- new SPC chart, lineage, or timeline components
- UAT execution or evidence capture
- generated contract changes unless the existing drift guardrail requires them
- Databricks SQL or live Databricks calls
- runtime app behaviour changes
- production readiness claims

## Suggested PR Slicing

1. `ci: add explicit backend and contract guardrails alongside nx affected`
2. `backend: migrate next domain adapter group to DatabricksRepository`
3. `backend: fix DatabricksRepository connection pooling lifecycle`
4. `adr(cache): define evidence-route cache and freshness policy`
5. `test(uat): capture focused Warehouse 360 and Trace Investigation evidence`
6. `feat(state): introduce workspace-level state management for selected high-prop-drilling workspace`
7. `feat(design-system): add first manufacturing-specific visual primitive`
