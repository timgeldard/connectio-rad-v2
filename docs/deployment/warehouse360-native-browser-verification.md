# Warehouse360 Native API Hardening & Browser Verification Guide

This guide documents the technical details of the Warehouse360 API hardening tranche, detailing Unity Catalog views, dynamic date/plant filtering logic, security constraints, and steps for final UAT browser-verification.

---

## 1. Hardened Native API Architecture

V2 integrates directly with production Databricks Unity Catalog views using the authenticated end user's OAuth identity. There is **no service-principal fallback** and **no PAT fallback** — if the OAuth token is absent, the system propagates a standard `401 Unauthorized` state.

### Mapped Unity Catalog Views
Each of the 5 native `GET` routes maps to a corresponding Unity Catalog view, dynamically filtering on `PLANT_ID` and specific date fields:

| Endpoint | Unity Catalog View | Mapped Date Column |
| :--- | :--- | :--- |
| `GET /api/warehouse360/overview` | `wh360_cockpit_summary_v` | *N/A (Overview aggregations)* |
| `GET /api/warehouse360/inbound` | `wh360_inbound_v` | `EXPECTED_DATE` |
| `GET /api/warehouse360/outbound` | `wh360_deliveries_v` | `PLANNED_GOODS_ISSUE_DATE` |
| `GET /api/warehouse360/staging` | `staging_orders_v` | `REQUIREMENT_DATE` |
| `GET /api/warehouse360/exceptions` | `wh360_imwm_exceptions_v` | `EXPIRY_DATE` |

---

## 2. Dynamic Filtering & Security Safeguards

To support rich cockpit operations, we added dynamic filtering in both the FastAPI routes and Databricks query factories:

### Query Parameters Mapped E2E
- `warehouse_id` (Mandatory, non-empty) — e.g. `WH-IE10-MAIN`
- `plant_id` (Optional) — e.g. `IE10`
- `date_from` (Optional, ISO `YYYY-MM-DD` / `YYYY-MM-DDTHH:MM:SS`)
- `date_to` (Optional, ISO `YYYY-MM-DD` / `YYYY-MM-DDTHH:MM:SS`)
- `limit` (Optional, defaults to `100`, clamped `[1, 500]`)

### Security Invariants & Clamped LIMIT
1. **No SQL Injection on LIMIT**: Databricks does not allow standard binding (e.g. `LIMIT :limit`) for the row limit clause in SQL statements.
2. **Safe Literal Interpolation**: To support customizable limits dynamically, we perform literal interpolation (`LIMIT {request.limit}`) in the SQL factory.
3. **Strict Validation Constraint**: This is completely safe and robust because the FastAPI routes aggressively validate and clamp the `limit` input parameters:
   - Must be a valid integer.
   - Clamped strictly between **1** and **500**.
   - If the limit is outside `[1, 500]`, the FastAPI route immediately intercepts and returns a `422 Unprocessable Entity` response, completely blocking any downstream query construction or statement execution.

---

## 3. Developer & UAT Verification Playbook (For Claude's sweep)

Since UAT/Databricks-connected verification sweeps are executed by Claude, follow these steps to verify in UAT:

### Phase A: FastAPI Swagger API Playground Validation
1. Deploy the api service to the UAT container.
2. Authenticate as an authorized UAT supervisor user.
3. Open the FastAPI documentation (`/docs`) in your browser.
4. Try out the Warehouse360 endpoints. Verify that:
   - Requesting with an empty `warehouse_id` returns `422`.
   - Requesting with a `limit` of `0` or `501` returns `422`.
   - Requesting with `plant_id` and date limits dynamically generates correct SQL queries with `PLANT_ID = :plant_id` and date bound params in the logs.

### Phase B: Frontend Adapter Route Activation
Before performing browser tests in UAT, activate the native endpoints in `warehouse-360-legacy-api-adapter.ts` by adding them to the `verifiedEndpoints` list:

```typescript
function isBrowserVerified(endpoint: string): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return true
  }
  const verifiedEndpoints: string[] = [
    'getWarehouseOverview',
    'getWarehouseInbound',
    'getWarehouseOutbound',
    'getWarehouseStaging',
    'getWarehouseExceptionItems'
  ]
  return verifiedEndpoints.includes(endpoint)
}
```

### Phase C: Workspace E2E Navigation & Filters Verification
1. Open the V2 UI at `?workspace=warehouse-workspace` in your browser.
2. Verify that:
   - Selecting different plants or timebounds automatically fires the fetch requests with correct query strings (e.g. `?warehouse_id=WH-IE10-MAIN&plant_id=IE10&date_from=2026-05-01&date_to=2026-05-31&limit=50`).
   - Mock data fallbacks do not activate for cockpit views when these are marked as browser-verified.
   - Real data loads correctly with `x-data-source: databricks-api` and `x-adapter-mode: databricks-api` headers on the responses.
