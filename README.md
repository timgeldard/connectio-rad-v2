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
DatabricksApiAdapter → native QuerySpec-backed routes through FastAPI
```

Active mode is configured at build time via `VITE_ADAPTER_MODE`:

```bash
VITE_ADAPTER_MODE=mock          # default in development
VITE_ADAPTER_MODE=legacy-api    # FastAPI proxy/same-origin HTTP; backend may execute V1 calls or native QuerySpecs
VITE_ADAPTER_MODE=databricks-api  # explicit frontend Databricks adapters where implemented
```

The backend has an independent `BACKEND_ADAPTER_MODE`. In Databricks Apps UAT,
`BACKEND_ADAPTER_MODE=databricks-api` is the primary path for native reads:
FastAPI routes execute QuerySpec definitions with the authenticated Databricks
user's OAuth identity. The frontend still talks to the same FastAPI API routes;
some domain packages expose those native routes from a `legacy-api` frontend
adapter for same-origin deployment compatibility.

Current native Databricks status:

| Domain | Native Databricks status |
|---|---|
| Traceability | Functional for Trace Graph / lineage routes; shell UI browser-verified on 2026-05-18. Batch-header and mass-balance remain DDL/source verification items. |
| EnvMon | Functional for `GET /api/envmon/site-summary` and `GET /api/envmon/swab-results`; read-only monitoring screen is wired to those routes. Spatial/floorplan/CAPA remain out of scope. |
| POH / Operations | Functional for order header, order operations, confirmations, and goods movements slices; other process-order review panels still use mock or pending adapters. |
| Warehouse 360 | Native route groundwork exists for overview/inbound/outbound/staging/exceptions; overview has returned HTTP 200 in UAT, while the remaining routes are partly schema/source blocked. |
| Quality / CQ Lab | CQ lab plants is browser-verified; CQ lab failures remains blocked by source view availability. |

### Evidence Panel pattern

Every data panel in the UI is an `EvidencePanel`. Panels declare:
- `EvidencePanelRegistration` — id, domain, lifecycle, required permissions, freshness policy
- `useEvidencePanel()` — manages displayState (loading / ready / stale / error / unauthorized)
- `source` — amber badge for `legacy-api`, green for `databricks-api`, none for `mock`

### FastAPI API layer

`apps/api/` serves both V1 proxy routes and native Databricks QuerySpec routes.
V1 proxy routes remain for systems not yet migrated. Native routes must not
fall back silently to mock or V1 when `BACKEND_ADAPTER_MODE=databricks-api`;
they return explicit 401/403/429/502/503/504 errors and source headers.

Selected route status:

| Route | Source | Domain | Status |
|---|---|---|---|
| `GET /api/trace2/graph` | Databricks `gold_batch_lineage` | Traceability | browser-verified |
| `GET /api/envmon/site-summary` | Databricks SAP QM gold views | EnvMon | browser-verified API |
| `GET /api/envmon/swab-results` | Databricks SAP QM gold views | EnvMon | browser-verified API |
| `POST /api/por/order-header` | V1 proxy or Databricks, mode-gated | Operations | Databricks browser-verified |
| `GET /api/por/order-operations` | Databricks | Operations | browser-verified |
| `GET /api/por/order-confirmations` | Databricks | Operations | browser-verified |
| `GET /api/por/order-goods-movements` | Databricks | Operations | browser-verified |
| `GET /api/warehouse360/overview` | Databricks WH360 views | Warehouse | UAT HTTP 200 |
| `GET /api/warehouse360/{inbound,outbound,staging,exceptions}` | Databricks WH360 views | Warehouse | wired; schema/source verification in progress |
| `GET /api/cq/lab/plants` | Databricks CQ/SAP QM | Quality | browser-verified |
| `GET /api/cq/lab/fails` | Databricks CQ/SAP QM | Quality | blocked by missing source view |
| `POST /api/trace2/batch-header` | V1 proxy or Databricks, mode-gated | Traceability | V1 proxy browser-verified; Databricks path pending DDL verification |

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
| Genie readiness index | `docs/migration/genie-readiness-index.md` |
| V1 Genie discovery and V2 parity roadmap | `docs/migration/v1-genie-discovery-and-v2-parity-roadmap.md` |
| V2 shell Genie decision record | `docs/migration/v2-shell-genie-decision-record.md` |
| Adapter migration strategy | `docs/adapters/adapter-migration-strategy.md` |
| Data / semantic model | `docs/data/semantic-model-overview.md` |
| V1 → V2 functionality preservation | `docs/migration/v1-to-v2-functionality-preservation.md` |
| Databricks Apps deployment | `docs/deployment/databricks-apps.md` |
| Workspace + panel registry | `docs/governance/workspace-and-panel-registry.md` |
| Cross-domain readiness index | `docs/readiness/domain-readiness-index.md` |
| Data-layer completion audit | `docs/data-layer/README.md` |
| UX truthfulness checklist | `docs/readiness/ux-truthfulness-checklist.md` |
| ADRs | `docs/adr/` |
