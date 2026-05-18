# Warehouse360 Native API — Browser Verification Log

**Domain:** Warehouse360  
**Routes:** `GET /api/warehouse360/{overview,inbound,outbound,staging,exceptions}`  
**Source schema:** Unity Catalog — `WH360_CATALOG.WH360_SCHEMA.*`  
**Adapters:** `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`  
**Routes file:** `apps/api/routes/warehouse360.py`

---

## Current Status: CONFIG-BLOCKED

**Date:** 2026-05-18  
**Commit:** `0b9d86895dd0ad0e68e02cf56ba2553c5c36e9a1`  

All 5 native WH360 routes are wired and tested locally (682 pytest pass with test-only `WH360_CATALOG=wh360_uat_catalog` fixture) but are **config-blocked in UAT** because `WH360_CATALOG` is not set in `apps/api/app.yaml`.

Without `WH360_CATALOG`, `resolve_domain_object("wh360", ...)` raises `DatabricksConfigError` and all routes return HTTP 503. No mock fallback, no silent legacy-api fallback — this is the expected and correct error behaviour.

**Required before testing:**
1. Confirm `WH360_CATALOG` value for the UAT Unity Catalog workspace (not derivable from current config or docs — must be supplied by user)
2. Confirm `WH360_SCHEMA` if different from the default `"wh360"`
3. Confirm a known `warehouse_id` value from UAT data
4. Add `WH360_CATALOG` (and optionally `WH360_SCHEMA`) to `apps/api/app.yaml`
5. Redeploy: `npm run prepare:databricks && databricks bundle deploy --target uat`
6. Run verification below

---

## Known Risks Before Testing

### 1. `LIMIT :max_rows` compatibility

The inbound/outbound/staging/exceptions QuerySpecs use a bound parameter for LIMIT:
```sql
LIMIT :max_rows
```

Databricks SQL may reject parameterised LIMIT. EnvMon's `swab-results` route avoided this by embedding the clamped integer directly in the SQL after route-level clamping. If any of the 4 routes return HTTP 500, the fix is to embed the clamped value as an f-string integer (consistent with EnvMon pattern). The overview route uses `LIMIT 1` directly and does not have this risk.

### 2. Source views may not exist in UAT

The referenced views are derived from V1 blueprints. Their existence in `WH360_CATALOG.WH360_SCHEMA` is not confirmed. If a view is absent, the route will return a Databricks 404/error that maps to HTTP 502. Document the missing object name and do not invent a replacement.

### 3. `warehouse_id` filter

All routes filter by `warehouse_id`. Without a known valid ID from UAT data, results will be empty. An empty result is not a failure — confirm the header indicates `databricks-api` and the shape is correct.

---

## Pre-UAT Config Checklist

- [ ] `WH360_CATALOG` value confirmed (user to supply)
- [ ] `WH360_SCHEMA` confirmed (default: `"wh360"`)
- [ ] Known `warehouse_id` for UAT data (user to supply)
- [ ] `apps/api/app.yaml` updated with `WH360_CATALOG`
- [ ] App redeployed and state: RUNNING

---

## Verification — API Routes

### W1 — Overview

```
GET /api/warehouse360/overview?warehouse_id=<id>
```

Expected:
- HTTP 200 (or 200 with empty counts if no data for warehouse)
- `x-data-source: databricks-api`
- `x-query-name: warehouse360.get_overview`
- Body: `{ "warehouseId": "...", "totalLocations": N, ... }`
- No mock data, no write endpoints

- [ ] HTTP status: ___
- [ ] `x-data-source`: ___
- [ ] `x-query-name`: ___
- [ ] Body shape valid: ___
- [ ] Notes: ___

### W2 — Inbound

```
GET /api/warehouse360/inbound?warehouse_id=<id>
```

Expected:
- HTTP 200 or honest empty list `[]`
- `x-data-source: databricks-api`
- `x-query-name: warehouse360.get_inbound`
- Body: array of inbound items

Watch for: HTTP 500 → likely `LIMIT :max_rows` incompatibility. Fix: embed clamped integer in SQL.

- [ ] HTTP status: ___
- [ ] `x-data-source`: ___
- [ ] `x-query-name`: ___
- [ ] Body shape valid: ___
- [ ] `LIMIT :max_rows` compatibility: ___
- [ ] Notes: ___

### W3 — Outbound

```
GET /api/warehouse360/outbound?warehouse_id=<id>
```

Same pattern as W2. Source: `wh360_deliveries_v`.

- [ ] HTTP status: ___
- [ ] `x-data-source`: ___
- [ ] `x-query-name`: ___
- [ ] Body shape valid: ___
- [ ] Notes: ___

### W4 — Staging

```
GET /api/warehouse360/staging?warehouse_id=<id>
```

Same pattern as W2. Source: `staging_orders_v`.

- [ ] HTTP status: ___
- [ ] `x-data-source`: ___
- [ ] `x-query-name`: ___
- [ ] Body shape valid: ___
- [ ] Notes: ___

### W5 — Exceptions

```
GET /api/warehouse360/exceptions?warehouse_id=<id>
```

Same pattern as W2. Source: `wh360_imwm_exceptions_v`.

- [ ] HTTP status: ___
- [ ] `x-data-source`: ___
- [ ] `x-query-name`: ___
- [ ] Body shape valid: ___
- [ ] Notes: ___

---

## Verification History

| Date | Commit | Route | Status | HTTP | x-query-name | Notes |
|------|--------|-------|--------|------|--------------|-------|
| 2026-05-18 | 0b9d868 | all 5 | CONFIG-BLOCKED | 503 (expected) | n/a | WH360_CATALOG not set in app.yaml |
