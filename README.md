# ConnectIO RAD V2

ConnectIO RAD (Rapid Application Development) V2 is a React + FastAPI application that provides supply-chain visibility and quality-management workspaces for Kerry Ingredients manufacturing operations. V2 replaces the original ConnectIO-RAD monolithic frontend with a domain-integration architecture that composes evidence across operational domains into purpose-built supervisor workspaces.

---

## Domains

| Domain integration | Package | Primary source system | Live workspaces |
|---|---|---|---|
| `di-traceability` | `@connectio/di-traceability` | Trace2 | Trace Investigation |
| `di-warehouse` | `@connectio/di-warehouse` | Warehouse 360 (WMS) | Warehouse 360 |
| `di-operations` | `@connectio/di-operations` | POH + Plan data | Process Order Review, Operations Plan Risk |
| `di-quality` | `@connectio/di-quality` | SAP QM | Quality Batch Release |
| `di-spc` | `@connectio/di-spc` | SPC system | SPC Monitoring |
| `di-maintenance` | `@connectio/di-maintenance` | Maintenance system | Maintenance & Reliability |
| `di-envmon` | `@connectio/di-envmon` | EnvMon | Environmental Monitoring |

---

## Architecture

```
apps/web/         React frontend (Vite, TypeScript)
apps/api/         FastAPI proxy backend (Python 3.11+)

domain-integrations/
  traceability/   Evidence panels, adapters, views for Trace2 domain
  warehouse/      Evidence panels, adapters, views for WH360 domain
  operations/     Evidence panels, adapters, views for POH/plan domain
  quality/        Evidence panels, adapters, views for QM domain
  spc/            Evidence panels for SPC domain
  maintenance/    Evidence panels for maintenance domain
  envmon/         Evidence panels for environmental monitoring
  analytics/      Cross-domain analytics

packages/
  data-contracts/         Zod schemas + TypeScript types for all domain entities
  product-model/          Workspace/panel registration types and lifecycle enums
  evidence-panel-runtime/ EvidencePanel component and useEvidencePanel hook
  workspace-runtime/      StandardWorkspaceTemplate and workspace primitives
  source-adapters/        AdapterResult<T> type, AdapterError, AdapterSource
  design-system/          Shared UI tokens and components
  auth-scope/             ScopeContext and role definitions
  feature-flags/          Feature flag primitives
  personalization/        User personalization hooks
  telemetry/              Telemetry and analytics primitives
```

### Adapter pattern

Each domain-integration has one adapter class per mode:

```
MockAdapter          → returns fixture data (always works, no backend needed)
LegacyApiAdapter     → extends Mock, overrides verified methods to call FastAPI proxy
DatabricksApiAdapter → future; calls Databricks SQL / Unity Catalog directly
```

Active mode is configured at build time via `VITE_ADAPTER_MODE`:

```bash
VITE_ADAPTER_MODE=mock          # default in development
VITE_ADAPTER_MODE=legacy-api    # uses FastAPI proxy → V1 backends
VITE_ADAPTER_MODE=databricks-api  # not yet implemented
```

### Evidence Panel pattern

Every data panel in the UI is an `EvidencePanel`. Panels declare:
- `EvidencePanelRegistration` — id, domain, lifecycle, required permissions, freshness policy
- `useEvidencePanel()` — manages displayState (loading / ready / stale / error / unauthorized)
- `source` — amber badge for `legacy-api`, green for `databricks-api`, none for `mock`

### FastAPI proxy

`apps/api/` proxies requests from the React frontend to V1 backends. See `apps/api/routes/` for individual verification status. Proxy routes:

| Route | V1 target | Domain | Status |
|---|---|---|---|
| `POST /api/trace2/batch-header` | V1 Trace2 batch-header | Traceability | browser-verified |
| `POST /api/wh360/warehouse-summary` | V1 WH360 summary | Warehouse | wired, not yet verified |
| `POST /api/por/order-header` | V1 POH order-header | Operations | wired, not yet verified |
| `GET /api/cq/lab/fails` | V1 CQ lab failures | Quality | wired, not yet verified |
| `GET /api/cq/lab/plants` | V1 CQ plant list | Quality | wired, not yet verified |

---

## Getting started

### Prerequisites

- Node.js 20+ and npm 10+
- Python 3.11+ (for API development)
- `uv` (Python package manager — see `pyproject.toml`)

### Development

```bash
# Install JS dependencies
npm install

# Start frontend (port 4200)
npm exec nx -- run web:dev

# Start FastAPI backend (port 8000)
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload --app-dir apps/api
```

### Running tests

```bash
# All domain tests
npm exec nx -- run-many --target=test --all

# Single domain
npm exec nx -- run di-traceability:test

# Typecheck
npm exec nx -- run-many --target=typecheck --all
```

### Building for production

```bash
npm exec nx -- run web:build
```

See `docs/deployment/databricks-apps.md` for Databricks Apps deployment.

---

## Key docs

| Topic | Location |
|---|---|
| Architecture overview | `docs/architecture/overview.md` |
| Adapter modes (mock / legacy-api / databricks-api) | `docs/adapters/mock-legacy-databricks-modes.md` |
| Adapter migration strategy | `docs/adapters/adapter-migration-strategy.md` |
| Data / semantic model | `docs/data/semantic-model-overview.md` |
| V1 → V2 functionality preservation | `docs/migration/v1-to-v2-functionality-preservation.md` |
| Databricks Apps deployment | `docs/deployment/databricks-apps.md` |
| Workspace + panel registry | `docs/governance/workspace-and-panel-registry.md` |
| Cross-domain readiness index | `docs/readiness/domain-readiness-index.md` |
| ADRs | `docs/adr/` |
