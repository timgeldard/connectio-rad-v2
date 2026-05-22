# Route Readiness Standard

No route should be added solely because a UI screen needs data. A route exposes a governed data product.

## Required Before Route Implementation

Before writing the FastAPI route or Databricks adapter query, the following must be documented:

- Data product name
- Business object
- Pattern
- Grain (e.g., one row per batch per plant)
- Source objects (verified tables/views)
- Filters
- Direct fields
- Derived fields
- Heuristic fields
- Unavailable fields
- Governance-pending fields
- Contract definition
- Expected error / unavailable states
- Test plan

## Route Readiness States

A route's lifecycle is tracked via these states:

- `not-started`
- `source-mapped`
- `contract-defined`
- `implemented`
- `response-model-enforced`
- `tested`
- `browser-UAT-pending`
- `browser-UAT-evidenced`
- `production-blocked`
- `production-ready`
