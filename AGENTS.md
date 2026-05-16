<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

---

# ConnectIO RAD V2 — Agent Context

This section provides project-specific context for AI agents working in this codebase. Read it before exploring, modifying, or extending any workspace, panel, or adapter.

---

## What this project is

ConnectIO RAD V2 is an internal supply-chain visibility and quality-management application for Kerry Ingredients manufacturing operations. It provides role-aware supervisor workspaces that aggregate evidence from multiple operational source systems (SAP Trace2, Warehouse 360, Process Order History, SAP QM, SPC, EnvMon, Maintenance) into a single composable UI.

V2 replaces the original ConnectIO-RAD monolithic frontend. The primary architectural innovation is the **domain-integration + evidence panel** model: every piece of data shown in the UI is declared as a governed evidence panel with explicit ownership, lifecycle, freshness policy, and confidence level.

---

## Architecture patterns — read before writing any code

### 1. AdapterResult<T>

All data fetching returns `AdapterResult<T>` from `@connectio/source-adapters`:

```typescript
type AdapterResult<T> =
  | { ok: true; data: T; fetchedAt: string; source?: AdapterSource }
  | { ok: false; error: AdapterError; displayState: DisplayState; source?: AdapterSource }

type AdapterSource = 'mock' | 'legacy-api' | 'databricks-api'
```

Always destructure with `result.ok` narrowing before accessing `result.data`.

### 2. Adapter hierarchy

Each domain-integration has a three-tier adapter hierarchy:

```
MockAdapter (base)
  └── LegacyApiAdapter extends Mock  ← only overrides verified V1 endpoints
        └── DatabricksApiAdapter extends LegacyApi  ← future
```

**Critical constraint — trim principle:** Only add proxy routes and adapter overrides for endpoints that have been browser-verified against V1. Do NOT add speculative routes to non-existent V1 endpoints — they cause 502/503 errors that break the UI.

### 3. Evidence Panel pattern

Every panel must:
1. Declare a `const registration: EvidencePanelRegistration` with all required fields
2. Use `useEvidencePanel({ panelId, staleAfterSeconds, lastRefreshedAt })`
3. Pass `displayState`, `errorMessage`, and `source={result?.source}` to `<EvidencePanel>`
4. Call `markReady()` on success and `markError()` on failure in a `useEffect`

Do not render data outside `<EvidencePanel>` — the panel handles loading/error/stale/unauthorized states.

### 4. Adapter mode selection

`VITE_ADAPTER_MODE` is read at module init in each adapter factory file. Valid values:
- `mock` — default; returns fixture data, no network calls
- `legacy-api` — calls FastAPI proxy at `VITE_LEGACY_API_BASE_URL` (default: `http://127.0.0.1:8000`)
- `databricks-api` — not yet implemented; falls back to legacy-api

The adapter factory pattern is the **only** place where `import.meta.env.VITE_ADAPTER_MODE` should be read.

---

## Domain-integration structure

Each domain-integration package (`di-*`) follows this layout:

```
src/
  adapters/
    <domain>-adapter.ts            ← base mock adapter class
    <domain>-adapter-factory.ts    ← reads VITE_ADAPTER_MODE, returns correct adapter
    <domain>-mock-data.ts          ← fixture data (realistic, SAP-style IDs)
    <domain>-legacy-api-adapter.ts ← extends mock, overrides verified methods
    <domain>-queries.ts            ← React Query hooks (useQuery wrappers)
    <domain>-adapter.test.ts       ← contract tests for mock adapter
    <domain>-legacy-api-adapter.test.ts ← contract tests for legacy adapter
  panels/
    <panel-name>-panel.tsx         ← evidence panel component
    <panel-name>-panel.test.tsx    ← panel component tests
  views/
    <view-name>-view.tsx           ← view composition (1-4 panels per view)
  <workspace-name>-workspace.tsx   ← workspace root component
  <workspace-name>-registration.ts ← workspace registration (views, nav, permissions)
  index.ts                         ← barrel export
```

---

## Shared packages — key responsibilities

| Package | Purpose |
|---|---|
| `@connectio/data-contracts` | Zod schemas + TypeScript types for all domain entities. Source of truth for data shapes. |
| `@connectio/product-model` | `EvidencePanelRegistration`, `WorkspaceRegistration`, lifecycle enums, `ScopeContext` |
| `@connectio/evidence-panel-runtime` | `<EvidencePanel>`, `useEvidencePanel()` hook, display state machine |
| `@connectio/workspace-runtime` | `<StandardWorkspaceTemplate>`, workspace navigation, role-aware home |
| `@connectio/source-adapters` | `AdapterResult<T>`, `AdapterError`, `AdapterSource` types |
| `@connectio/design-system` | Design tokens, base UI components |
| `@connectio/auth-scope` | `ScopeContext`, role definitions |

---

## FastAPI proxy — `apps/api/`

The Python backend proxies requests from the React frontend to V1 backends. It uses secret-scope env vars (never hardcoded URLs).

Currently verified proxy routes (browser-tested against V1):
- `POST /api/trace2/batch-header` → V1 Trace2
- `POST /api/wh360/warehouse-summary` → V1 Warehouse 360
- `POST /api/por/order-header` → V1 POH

Do NOT add new routes without confirming the V1 endpoint exists and returns expected data.

---

## Testing conventions

- **Mock adapter tests** (`<domain>-adapter.test.ts`): import adapter class directly, assert schema validity with Zod `safeParse`, check `fetchedAt` timestamp.
- **Legacy adapter tests** (`<domain>-legacy-api-adapter.test.ts`): stub global `fetch` with `vi.stubGlobal`, provide realistic V1-shaped fixtures, test 401/404/500/network failure, verify fallback to mock when required context is missing.
- **Panel component tests** (`.test.tsx`): mock `@xyflow/react` (if used), mock `@connectio/evidence-panel-runtime`, mock the query hook, test interaction behavior.
- **Do not** write snapshot tests — they couple tests to markup that changes.

Coverage thresholds (per domain): 60% lines/functions/branches/statements.

---

## What NOT to do without explicit user direction

- Do not add new governance screens, pilot phases, or rollout tracking
- Do not add new proxy routes unless the V1 endpoint is confirmed and browser-tested
- Do not add new adapter overrides beyond the verified endpoint per domain
- Do not add mock data for features that do not yet exist in V1
- Do not push to `main` — V2 uses `main` as the primary branch; pushes require explicit user authorization

---

## Running the project locally

```bash
# JS deps
npm install

# Frontend dev server (port 4200)
npm exec nx -- run web:dev

# FastAPI (port 8000)
python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload --app-dir apps/api

# Tests
npm exec nx -- run-many --target=test --all

# Typecheck
npm exec nx -- run-many --target=typecheck --all
```

---

## Key docs

- `docs/architecture/overview.md` — monorepo structure, domain-integration pattern
- `docs/adapters/mock-legacy-databricks-modes.md` — adapter mode configuration
- `docs/adapters/adapter-migration-strategy.md` — lifecycle: mock → legacy-api → databricks-api
- `docs/data/semantic-model-overview.md` — data contracts and entity model
- `docs/deployment/databricks-apps.md` — production deployment
- `docs/adr/` — architectural decision records (ADR-001 through ADR-023)
