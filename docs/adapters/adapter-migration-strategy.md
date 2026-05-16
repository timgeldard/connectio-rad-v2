# Adapter Migration Strategy

## The lifecycle: mock → legacy-api → databricks-api

ConnectIO RAD V2 uses a three-tier adapter hierarchy. Every domain-integration starts at `mock` and advances through `legacy-api` toward `databricks-api` as endpoints are verified and V1 backends are confirmed ready. No tier is skipped.

```
mock  →  legacy-api  →  databricks-api
  │            │               │
  │        V1 bridge        Direct SQL/UC
  │        (FastAPI)        (no proxy)
  │
  └─ always the fallback
```

---

## When to use each tier

| Tier | Use when | Data source |
|---|---|---|
| `mock` | V1 endpoint unknown, unavailable, or unverified | Static fixture file |
| `legacy-api` | V1 endpoint confirmed + browser-tested; V1 backend is authoritative | FastAPI proxy → V1 |
| `databricks-api` | V1 retired; data migrated to Databricks SQL / Unity Catalog | Direct Databricks query |

---

## Advancing from mock to legacy-api

A method may be overridden in the legacy adapter only when:

1. **V1 endpoint confirmed** — the endpoint URL, HTTP method, and request/response shape are known from the V1 source system team
2. **Proxy route added** — a corresponding route exists in `apps/api/routes/<domain>.py`
3. **Browser-verified** — the proxy route has been tested end-to-end in a browser against a live V1 backend (not just unit-tested)
4. **Contract tests written** — `<domain>-legacy-api-adapter.test.ts` covers: success, 401, 404, 500, network failure, and fallback-to-mock when context is missing

Do not advance to legacy-api based on V1 API documentation alone — field names, casing, and data presence are only reliably known after live testing.

---

## Advancing from legacy-api to databricks-api

A method may be overridden in the databricks adapter only when:

1. **V1 backend retired or scheduled for retirement** — confirmed with the source system team
2. **Data available in Databricks** — the equivalent data is queryable from Unity Catalog or a Databricks SQL warehouse
3. **Schema validated** — the Databricks response maps cleanly to the `@connectio/data-contracts` type (same Zod schema as the legacy adapter uses)
4. **Pilot sign-off** — the workspace that consumes this panel has completed pilot and received sign-off

The databricks-api adapter extends the legacy-api adapter and overrides specific methods. Unimplemented methods fall back to `super` (legacy-api), which in turn falls back to mock if the legacy endpoint is also absent.

---

## Adding a new override: step-by-step

### legacy-api override

1. Get the V1 endpoint spec (URL, method, request/response shape)
2. Add a proxy route in `apps/api/routes/<domain>.py` following the existing pattern:
   ```python
   @router.post("/<domain>/<endpoint>")
   async def endpoint_handler(body: RequestModel, ...) -> dict:
       return await _forward_post("/api/v1/...", body.model_dump(), token)
   ```
3. Register the router in `apps/api/main.py` if not already done
4. Test the proxy route manually: `curl -X POST http://127.0.0.1:8000/api/<domain>/<endpoint>`
5. Override the adapter method in `<domain>-legacy-api-adapter.ts`:
   ```typescript
   override async getMethodName(request): Promise<AdapterResult<ContractType>> {
     if (!request.requiredField) return super.getMethodName(request)
     // fetch, map, return with source: 'legacy-api'
   }
   ```
6. Map V1 snake_case fields to contract types using `??` fallbacks for camelCase variants
7. Always set `source: 'legacy-api'` on both success and error returns
8. Write contract tests in `<domain>-legacy-api-adapter.test.ts`
9. Browser-verify the end-to-end flow with `VITE_ADAPTER_MODE=legacy-api`

### databricks-api override

<!-- TODO: Document databricks-api override pattern once the first implementation is written. See ADR-024 (docs/adr/ADR-024-native-databricks-data-access-architecture.md) for the QuerySpec/QueryExecutor architecture, source badge contract, cache tier definitions, and module migration order (POH → Trace → SPC → Quality/Lab → EnvMon → Warehouse). -->

---

## Fallback chain

The adapter class hierarchy ensures graceful degradation at runtime:

```
DatabricksApiAdapter.getMethod()
  → if not overridden: LegacyApiAdapter.getMethod()
       → if not overridden or context missing: MockAdapter.getMethod()
            → returns fixture data (always succeeds)
```

This means:
- A panel never crashes due to an unimplemented adapter method
- The UI always shows *something* — mock data with no source badge if the higher tier fails
- Source badge visibility makes the data origin transparent to users

---

## Code comments and type annotations

Add a JSDoc comment to every overridden method explaining its tier status:

```typescript
/**
 * Proxy to V1 batch-header endpoint.
 * Tier: legacy-api — browser-verified 2024-03-08.
 * Next tier: databricks-api (pending V1 Trace2 retirement).
 */
override async getBatchHeaderSummary(request): Promise<AdapterResult<BatchHeaderSummary>> {
```

Mark each adapter class with its tier in its class JSDoc:

```typescript
/**
 * Tier: legacy-api
 * Verified methods: getBatchHeaderSummary
 * Fallback: Trace2Adapter (mock)
 */
export class Trace2LegacyApiAdapter extends Trace2Adapter {
```

---

## Current state (as of 2026-05-16)

| Domain | Adapter class | Legacy-api overrides | Remaining on mock |
|---|---|---|---|
| Traceability | `Trace2LegacyApiAdapter` | `getBatchHeaderSummary` ¹ | 10 methods |
| Warehouse | `Warehouse360LegacyApiAdapter` | `getWarehouse360Summary` | 8 methods |
| Operations (POR) | `ProcessOrderReviewLegacyApiAdapter` | `getProcessOrderHeader` | 9 methods |
| Operations (plan risk) | none — no legacy adapter yet | — | all 9 methods |
| Quality | `ConnectedQualityLabLegacyApiAdapter` | `getLabFailures`, `getLabPlants` | 0 methods (all overridden) |
| SPC | none | — | all 9 methods |
| Maintenance | none | — | all methods |
| EnvMon | none | — | all methods |

¹ Browser-verified against a live V1 backend. All other legacy-api overrides are **wired** (proxy route + adapter code exist) but have not been tested end-to-end against a live V1 instance. Do not promote wired methods to "verified" in this table until browser-testing is complete.

---

## Governance

- Tier advancement for a method is a **product decision**, not just a technical one — confirm with the domain owner that the V1 endpoint is stable and the data contract is agreed
- The `source` badge in the UI makes the adapter tier visible to end users and pilots — amber = legacy-api, green = databricks-api
- Pilot sign-off criteria in `docs/adr/ADR-016-pilot-validation-and-signoff-model.md` include a requirement that all panels used in the pilot are at `legacy-api` tier or higher for the workspaces under test
- Do not advance a method to `legacy-api` without the corresponding contract tests — the tests are the audit trail that the V1 contract was understood and validated
