# Warehouse360 Native API — Browser Verification Log

**Domain:** Warehouse360  
**Routes:** `GET /api/warehouse360/{overview,inbound,outbound,staging,exceptions}`  
**Source schema:** Unity Catalog — `WH360_CATALOG.WH360_SCHEMA.*`  
**Adapters:** `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`  
**Routes file:** `apps/api/routes/warehouse360.py`

---

## Current Status: DDL-BLOCKED (3 of 5 routes)

**Date:** 2026-05-18  

| Route | Status |
|---|---|
| W1 Overview | **HTTP 200** ✓ — `wh360_kpi_snapshot_v` confirmed, LIMIT 1 embedded |
| W2 Inbound | **PENDING RE-TEST** — `wh360_inbound_v` confirmed to exist, LIMIT 1000 fix deployed |
| W3 Outbound | **DDL-BLOCKED** — `wh360_deliveries_v` exists but has no `WAREHOUSE_NUMBER` column; need `DESCRIBE TABLE` to find correct filter column |
| W4 Staging | **SOURCE-BLOCKED** — `staging_orders_v` does not exist in `connected_plant_uat.wh360` |
| W5 Exceptions | **SOURCE-BLOCKED** — `wh360_imwm_exceptions_v` does not exist in `connected_plant_uat.wh360` |

**Unblock actions required:**
1. Run `DESCRIBE TABLE connected_plant_uat.wh360.wh360_deliveries_v` → find warehouse filter column → fix W3 QuerySpec WHERE clause
2. Run `SHOW VIEWS IN connected_plant_uat.wh360` → identify correct views for staging and exceptions → update W4/W5 QuerySpecs or confirm routes must be blocked

Do not invent replacement view names. Update adapter only after DDL is confirmed.

**Config confirmed (2026-05-18):**
- `WH360_CATALOG=connected_plant_uat` — set in `app.yaml` ✓
- `WH360_SCHEMA=wh360` — default in `object_resolver.py`; confirmed correct for UAT ✓
- Known warehouse IDs for UAT: **`104`** and **`105`** ✓
- `LIMIT :max_rows` bound parameter — **FIXED** — all 4 list QuerySpecs now use `LIMIT 1000` literal ✓

---

## Known Issues (UAT findings, 2026-05-18)

### 1. `LIMIT :max_rows` — FIXED

`LIMIT :max_rows` bound parameter was confirmed incompatible with Databricks SQL — all 4 list routes returned HTTP 502 in first test. Fixed by embedding `LIMIT 1000` as a literal integer in all 4 list QuerySpecs and removing `max_rows` from params dict.

### 2. `wh360_deliveries_v` — wrong filter column (W3 DDL-BLOCKED)

`wh360_deliveries_v` exists in `connected_plant_uat.wh360` but does not have a `WAREHOUSE_NUMBER` column. The outbound QuerySpec `WHERE WAREHOUSE_NUMBER = :warehouse_id` is incorrect. Need `DESCRIBE TABLE connected_plant_uat.wh360.wh360_deliveries_v` to find the correct column name.

### 3. `staging_orders_v` — does not exist (W4 SOURCE-BLOCKED)

`staging_orders_v` is not present in `connected_plant_uat.wh360`. Staging route returns HTTP 502. Need `SHOW VIEWS IN connected_plant_uat.wh360` to identify the correct view, or confirm staging is not available in UAT.

### 4. `wh360_imwm_exceptions_v` — does not exist (W5 SOURCE-BLOCKED)

`wh360_imwm_exceptions_v` is not present in `connected_plant_uat.wh360`. Exceptions route returns HTTP 502. Same unblock path as W4.

---

## Pre-UAT Config Checklist

- [x] `WH360_CATALOG=connected_plant_uat` confirmed and set in `app.yaml` (commit `33fe43a`)
- [x] `WH360_SCHEMA=wh360` (default, confirmed correct for UAT)
- [x] Known `warehouse_id` for UAT: **104** and **105**
- [x] `apps/api/app.yaml` updated with `WH360_CATALOG`
- [ ] App redeployed and state: RUNNING

---

## Verification — API Routes

### W1 — Overview — SOURCE-PENDING

```
GET /api/warehouse360/overview?warehouse_id=<id>
```

**Status: SOURCE-PENDING** — `connected_plant_uat.wh360.wh360_cockpit_summary_v` does not exist in UAT. Route will return an error (502 or 500) until the correct view name is confirmed. Do not invent a replacement.

**Required:** Confirm the actual UAT view name for the WH360 cockpit/overview summary (the V1-equivalent of `wh360_cockpit_summary_v`). Once known, update `get_warehouse_overview_spec` in `warehouse360_databricks_adapter.py`.

- [ ] Actual overview view name confirmed: ___
- [ ] QuerySpec updated with correct view name
- [ ] HTTP status: ___
- [ ] `x-data-source`: ___
- [ ] `x-query-name`: ___

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

### W3 — Outbound — DDL-BLOCKED

```
GET /api/warehouse360/outbound?warehouse_id=<id>
```

**Status: DDL-BLOCKED** — `wh360_deliveries_v` exists but has no `WAREHOUSE_NUMBER` column. QuerySpec WHERE clause is incorrect.

**Unblock:** `DESCRIBE TABLE connected_plant_uat.wh360.wh360_deliveries_v` → find warehouse filter column → update `get_warehouse_outbound_spec` WHERE clause in adapter.

- [ ] Correct filter column confirmed: ___
- [ ] QuerySpec WHERE updated
- [ ] HTTP status: ___
- [ ] `x-data-source`: ___
- [ ] `x-query-name`: ___

### W4 — Staging — SOURCE-BLOCKED

```
GET /api/warehouse360/staging?warehouse_id=<id>
```

**Status: SOURCE-BLOCKED** — `staging_orders_v` does not exist in `connected_plant_uat.wh360`.

**Unblock:** `SHOW VIEWS IN connected_plant_uat.wh360` → identify correct staging view → update `get_warehouse_staging_spec`, or confirm staging is unavailable in UAT and mark route as permanently blocked.

- [ ] Correct view name confirmed: ___
- [ ] QuerySpec updated or route blocked
- [ ] HTTP status: ___

### W5 — Exceptions — SOURCE-BLOCKED

```
GET /api/warehouse360/exceptions?warehouse_id=<id>
```

**Status: SOURCE-BLOCKED** — `wh360_imwm_exceptions_v` does not exist in `connected_plant_uat.wh360`.

**Unblock:** Same as W4 — `SHOW VIEWS IN connected_plant_uat.wh360` → identify correct exceptions view.

- [ ] Correct view name confirmed: ___
- [ ] QuerySpec updated or route blocked
- [ ] HTTP status: ___

---

## Verification History

| Date | Commit | Route | Status | HTTP | x-query-name | Notes |
|------|--------|-------|--------|------|--------------|-------|
| 2026-05-18 | 0b9d868 | all 5 | CONFIG-BLOCKED | 503 (expected) | n/a | WH360_CATALOG not set in app.yaml |
| 2026-05-18 | 9b50467 | overview | SOURCE-PENDING | n/a | n/a | wh360_cockpit_summary_v does not exist in connected_plant_uat.wh360 |
| 2026-05-18 | 9b50467 | inbound | PENDING BV | — | — | wh360_inbound_v confirmed to exist; pending redeploy + browser test |
| 2026-05-18 | — | overview | **HTTP 200** ✓ | 200 | warehouse360.get_overview | wh360_kpi_snapshot_v confirmed; LIMIT 1; no warehouse_id filter |
| 2026-05-18 | — | inbound | PENDING RE-TEST | — | — | LIMIT 1000 fix deployed; wh360_inbound_v exists; re-test required |
| 2026-05-18 | — | outbound | **DDL-BLOCKED** | 502 | n/a | wh360_deliveries_v exists but no WAREHOUSE_NUMBER column; need DESCRIBE |
| 2026-05-18 | — | staging | **SOURCE-BLOCKED** | 502 | n/a | staging_orders_v does not exist in connected_plant_uat.wh360 |
| 2026-05-18 | — | exceptions | **SOURCE-BLOCKED** | 502 | n/a | wh360_imwm_exceptions_v does not exist in connected_plant_uat.wh360 |
