# Adapter Modes: mock / legacy-api / databricks-api

## Overview

Each domain-integration adapter supports three modes, selected at build time via `VITE_ADAPTER_MODE`. The mode determines where panel data comes from and whether any network calls are made.

```
VITE_ADAPTER_MODE=mock            default in development
VITE_ADAPTER_MODE=legacy-api      calls FastAPI proxy → V1 backends
VITE_ADAPTER_MODE=databricks-api  (future — not yet implemented)
```

The value is baked into the JS bundle at build time. Changing it requires a rebuild.

---

## Mode: `mock`

The base adapter class for each domain returns realistic fixture data from a static mock-data file. No network calls are made.

**When to use:**
- Local development when V1 backends are unavailable
- Demos and presentations
- Running tests (default)

**Source badge:** none (no badge shown in the UI)

**Data location:**
```
domain-integrations/<domain>/src/adapters/<domain>-mock-data.ts
```

**Activation:**
```bash
# .env.local (or omit VITE_ADAPTER_MODE entirely)
VITE_ADAPTER_MODE=mock
```

---

## Mode: `legacy-api`

The legacy-api adapter extends the mock adapter and overrides specific methods to call the FastAPI proxy at `VITE_LEGACY_API_BASE_URL` (default: `http://127.0.0.1:8000` in development, injected via Databricks Apps in production).

Methods that have been verified against V1 are overridden. All other methods fall back to `super` (mock data). This means the UI never breaks — unverified panels show mock data until their V1 endpoint is confirmed.

**When to use:**
- Integration testing against a real V1 backend
- Production deployment (Databricks Apps)
- Verifying that a new proxy route works end-to-end

**Source badge:** amber badge in every panel whose data came from this mode

**Browser-verified overrides** — tested end-to-end against a live V1 backend:

| Domain | Adapter class | Method | FastAPI route |
|---|---|---|---|
| Traceability | `Trace2LegacyApiAdapter` | `getBatchHeaderSummary` | `POST /api/trace2/batch-header` |

**Wired but not browser-verified** — proxy route and adapter override exist; live V1 testing not yet completed:

| Domain | Adapter class | Method | FastAPI route |
|---|---|---|---|
| Warehouse | `Warehouse360LegacyApiAdapter` | `getWarehouse360Summary` | `POST /api/wh360/warehouse-summary` |
| Operations | `ProcessOrderReviewLegacyApiAdapter` | `getProcessOrderHeader` | `POST /api/por/order-header` |
| Quality | `ConnectedQualityLabLegacyApiAdapter` | `getLabFailures` | `GET /api/cq/lab/fails` |
| Quality | `ConnectedQualityLabLegacyApiAdapter` | `getLabPlants` | `GET /api/cq/lab/plants` |

Do not mark a method as browser-verified until it has been tested end-to-end in a browser with `VITE_ADAPTER_MODE=legacy-api` against a live V1 backend that returned real data.

**Activation:**
```bash
VITE_ADAPTER_MODE=legacy-api
VITE_LEGACY_API_BASE_URL=http://127.0.0.1:8000   # development default
```

**Adding a new override:**
1. Confirm the V1 endpoint exists and returns expected data (browser-verify)
2. Add a proxy route in `apps/api/routes/<domain>.py`
3. Override the corresponding method in `<domain>-legacy-api-adapter.ts`
4. Add contract tests in `<domain>-legacy-api-adapter.test.ts`
5. Do not add routes for endpoints that have not been verified — 502/503 errors break the UI

---

## Mode: `databricks-api`

Not yet implemented. The adapter factory falls back to `legacy-api` when `VITE_ADAPTER_MODE=databricks-api` is set.

This tier will call Databricks SQL / Unity Catalog directly without the FastAPI proxy layer. It is the target steady state after V1 retirement.

**Source badge (planned):** green badge

**Activation (future):**
```bash
VITE_ADAPTER_MODE=databricks-api
VITE_DATABRICKS_API_BASE_URL=https://<workspace-host>
```

---

## Adapter factory pattern

Each domain-integration exposes a factory file that reads `VITE_ADAPTER_MODE` exactly once at module init:

```typescript
// domain-integrations/traceability/src/adapters/trace2-adapter-factory.ts
const mode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
const baseUrl = import.meta.env.VITE_LEGACY_API_BASE_URL ?? 'http://127.0.0.1:8000'

export const trace2AdapterInstance: Trace2Adapter =
  mode === 'legacy-api' ? new Trace2LegacyApiAdapter(baseUrl) : new Trace2Adapter()
```

All React Query hooks import from the factory, not the adapter class directly. This is the only place where `import.meta.env.VITE_ADAPTER_MODE` should be accessed.

---

## Testing adapters

**Mock adapter tests** (`<domain>-adapter.test.ts`):
- Import the base adapter class directly
- Call methods and validate returned data against Zod schemas
- Do not stub `fetch` — no network calls are made

**Legacy adapter tests** (`<domain>-legacy-api-adapter.test.ts`):
- Stub `fetch` with `vi.stubGlobal` using realistic V1-shaped fixtures
- Test all HTTP error codes (401, 404, 500) and network failures
- Verify fallback to mock when required context (e.g. `batchId`) is absent
- Verify `source: 'legacy-api'` on successful responses
- Verify `source: 'legacy-api'` on error responses

---

## Environment variable reference

| Variable | Mode | Default | Purpose |
|---|---|---|---|
| `VITE_ADAPTER_MODE` | all | `mock` | Selects adapter tier at build time |
| `VITE_LEGACY_API_BASE_URL` | legacy-api | `http://127.0.0.1:8000` | FastAPI proxy base URL (dev) |
| `V1_TRACE_API_BASE_URL` | legacy-api (server) | — | V1 Trace2 backend URL (Databricks secret) |
| `V1_WH360_API_BASE_URL` | legacy-api (server) | — | V1 WH360 backend URL (Databricks secret) |
| `V1_POH_API_BASE_URL` | legacy-api (server) | — | V1 POH backend URL (Databricks secret) |
| `V1_CQ_API_BASE_URL` | legacy-api (server) | — | V1 Connected Quality backend URL (Databricks secret) |

Server-side variables (`V1_*`) are injected by Databricks Apps from the `connectio-v2` secret scope. They are never hardcoded in the repo.
