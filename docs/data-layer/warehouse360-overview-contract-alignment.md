# Warehouse360 Overview Contract Alignment Analysis

**Date:** 2026-05-22
**Branch:** `feature/spc-native-contract-alignment` (analysis only; no runtime changes)
**Status:** **ANALYSIS COMPLETE — implementation requires Databricks access (Option C)**
**Relates to:** `backend-contract-enforcement-plan.md` — `GET /api/warehouse360/overview` skip-contract-mismatch (unresolved)

---

## Background

`GET /api/warehouse360/overview` was skipped from backend `response_model` enforcement in PR #71 (branch `feature/backend-contract-enforcement`) because the mapper output shape is completely different from the `Warehouse360Overview` Pydantic model.

This document analyses the mismatch, checks for a promotable native schema in the frontend (the discriminator used in the EnvMon swab alignment), and recommends a safe resolution path.

---

## What the mapper returns (`map_warehouse_overview_rows`)

`apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py` — `map_warehouse_overview_rows()`

Source view: `wh360_kpi_snapshot_v` — **global single-row KPI snapshot**. The SQL has no `WHERE` clause and ignores the `plant_id`/`date_from`/`date_to` request parameters.

SQL selects:

```sql
SELECT
    orders_total, orders_red, orders_amber,
    trs_open, tos_open,
    deliveries_today, deliveries_at_risk,
    inbound_open,
    bins_blocked, bins_total, bin_util_pct
FROM {catalog}.{schema}.wh360_kpi_snapshot_v
LIMIT 1
```

The mapper emits 12 camelCase keys:

| Mapper field | Source column | DDL status |
|---|---|---|
| `warehouseId` | from request param (not a view column) | code-inferred |
| `ordersTotal` | `orders_total` | code-inferred (column not DDL-verified) |
| `ordersRed` | `orders_red` | code-inferred |
| `ordersAmber` | `orders_amber` | code-inferred |
| `trsOpen` | `trs_open` | code-inferred |
| `tosOpen` | `tos_open` | code-inferred |
| `deliveriesToday` | `deliveries_today` | code-inferred |
| `deliveriesAtRisk` | `deliveries_at_risk` | code-inferred |
| `inboundOpen` | `inbound_open` | code-inferred |
| `binsBlocked` | `bins_blocked` | code-inferred |
| `binsTotal` | `bins_total` | code-inferred |
| `binUtilPct` | `bin_util_pct` | code-inferred (float) |

---

## Existing `Warehouse360OverviewSchema`

`packages/data-contracts/src/schemas/warehouse-360-overview.ts` — `Warehouse360OverviewSchema`

13 fields:

| Field | Type | Required? |
|---|---|---|
| `plantId` | string | required |
| `warehouseId` | string | required |
| `inboundDueCount` | int ≥ 0 | required |
| `inboundOverdueCount` | int ≥ 0 | required |
| `outboundDueCount` | int ≥ 0 | required |
| `outboundOverdueCount` | int ≥ 0 | required |
| `stagingOpenCount` | int ≥ 0 | required |
| `stagingOverdueCount` | int ≥ 0 | required |
| `nearExpiryCount` | int ≥ 0 | required |
| `reconciliationExceptionCount` | int ≥ 0 | required |
| `blockedStockCount` | int ≥ 0 | required |
| `source` | string | optional |
| `warnings` | string[] | optional |

---

## Frontend adapter check (the EnvMon discriminator)

`domain-integrations/warehouse/src/adapters/warehouse-360-legacy-api-adapter.ts` — `getWarehouseOverview()`

This is the discriminating check: in the EnvMon case, a local frontend schema (`EnvMonNativeSwabResultSchema`) already matched the mapper output and could be promoted. No such schema exists here.

The frontend mapper for `getWarehouseOverview` (lines 149–161) reads:

```typescript
const mapped: Warehouse360Overview = {
  plantId: String(raw.plantId ?? ''),
  warehouseId: String(raw.warehouseId ?? request.warehouseId),
  inboundDueCount: Number(raw.inboundDueCount ?? 0),
  inboundOverdueCount: Number(raw.inboundOverdueCount ?? 0),
  outboundDueCount: Number(raw.outboundDueCount ?? 0),
  outboundOverdueCount: Number(raw.outboundOverdueCount ?? 0),
  stagingOpenCount: Number(raw.stagingOpenCount ?? 0),
  stagingOverdueCount: Number(raw.stagingOverdueCount ?? 0),
  nearExpiryCount: Number(raw.nearExpiryCount ?? 0),
  reconciliationExceptionCount: Number(raw.reconciliationExceptionCount ?? 0),
  blockedStockCount: Number(raw.blockedStockCount ?? 0),
}
```

Key findings:
- The frontend already expects the `Warehouse360Overview` contract shape — not the V1 KPI shape.
- `isBrowserVerified('getWarehouseOverview')` returns `true` (the method is in `verifiedEndpoints`).
- There is **no local frontend schema matching the V1 KPI keys** (`ordersTotal`, `trsOpen`, etc.).
- Current live behavior: the backend returns `ordersTotal`, `trsOpen`, etc.; the frontend maps `raw.inboundDueCount ?? 0` for all count fields — **all counts silently return 0**. The mismatch is actively masking missing data.

---

## Field-by-field alignment table

### Contract fields vs current mapper

| Contract field | Current mapper field | Source column | Confidence | Safe action |
|---|---|---|---|---|
| `plantId` | absent | not in SQL; unclear if view exposes `plant_id` | unknown | **needs-Databricks-verification** |
| `warehouseId` | `warehouseId` (from request) | request param, not a view column | code-inferred | **map-directly** (already correct) |
| `inboundDueCount` | absent (closest: `inboundOpen`) | `inbound_open` ≠ due; semantics differ | unknown | **needs-Databricks-verification** — do not silently map `inbound_open` |
| `inboundOverdueCount` | absent | not in SQL | unknown | **needs-Databricks-verification** |
| `outboundDueCount` | absent | not in SQL | unknown | **needs-Databricks-verification** |
| `outboundOverdueCount` | absent | not in SQL | unknown | **needs-Databricks-verification** |
| `stagingOpenCount` | absent | not in SQL | unknown | **needs-Databricks-verification** |
| `stagingOverdueCount` | absent | not in SQL | unknown | **needs-Databricks-verification** |
| `nearExpiryCount` | absent | not in SQL | unknown | **needs-Databricks-verification** |
| `reconciliationExceptionCount` | absent | not in SQL | unknown | **needs-Databricks-verification** |
| `blockedStockCount` | absent (closest: `binsBlocked`) | `bins_blocked` = bin count ≠ stock line count; semantics differ | unknown | **needs-Databricks-verification** — do not silently map `bins_blocked` |
| `source` | absent | N/A — derived | code-inferred | add to mapper when rewriting (e.g. `"databricks-api"`) |
| `warnings` | absent | N/A — derived | code-inferred | leave-unavailable initially |

**1 of 13 contract fields** (`warehouseId`) can be honestly populated from current code. All 9 required numeric count fields and `plantId` require Databricks verification.

### V1 KPI mapper fields with no contract analog

| Mapper field | Source column | Contract analog | Safe action |
|---|---|---|---|
| `ordersTotal` | `orders_total` | none | remove when mapper is rewritten |
| `ordersRed` | `orders_red` | none | remove |
| `ordersAmber` | `orders_amber` | none | remove |
| `trsOpen` | `trs_open` | none | remove |
| `tosOpen` | `tos_open` | none | remove |
| `deliveriesToday` | `deliveries_today` | none | remove |
| `deliveriesAtRisk` | `deliveries_at_risk` | none | remove |
| `inboundOpen` | `inbound_open` | `inboundDueCount` — different semantics | do NOT silently map |
| `binsBlocked` | `bins_blocked` | `blockedStockCount` — bin count ≠ stock lines | do NOT silently map |
| `binsTotal` | `bins_total` | none | remove |
| `binUtilPct` | `bin_util_pct` | none | remove |

---

## Why the closest analogs cannot be silently mapped

**`inbound_open` → `inboundDueCount`**: "open" inbound items (not yet received) is not the same as items "due" today or within a planning window. The semantics differ and no business rule has been agreed. Silent mapping would misrepresent the figure.

**`bins_blocked` → `blockedStockCount`**: a blocked bin count is not a blocked stock line count. A single bin may hold multiple stock lines; a stock line may span bins. Silent mapping would produce a systematically different number with no user visibility.

---

## Recommended decision: Option C

### Why not Option A (rewrite mapper to emit contract shape)?

Option A is the **correct long-term fix** — the backend must eventually emit `inboundDueCount`, `outboundDueCount`, etc. to match the contract. However, Option A cannot be safely implemented without Databricks access because:

1. `wh360_kpi_snapshot_v` may or may not expose `inbound_due_count`, `outbound_due_count`, `staging_open_count`, `near_expiry_count`, `reconciliation_exception_count`, `blocked_stock_count` columns. The current SQL does not select them; their existence is unknown.
2. `plant_id` may or may not be a column in the view (currently the view appears to be a global aggregate with no plant filter).
3. If `wh360_kpi_snapshot_v` does not have the required columns, a new view or query may be needed — which requires data platform input, not just a mapper rewrite.

### Why not Option B (introduce `Warehouse360NativeKpiSchema`)?

Option B was the correct choice for EnvMon because the frontend had already defined a native schema matching the mapper output. Here, no such schema exists. The frontend already expects the `Warehouse360Overview` shape. Introducing a new native KPI contract for `ordersTotal`, `trsOpen`, etc. would:

- Create an API shape with no current frontend consumer (the frontend adapter maps to `Warehouse360Overview`, not V1 KPI keys).
- Perpetuate the display gap: all 9 count fields would show 0 in the frontend until the frontend adapter is also rewritten.
- Add technical debt with no path to resolving the underlying mismatch.

### Option C: keep route unenforced; document verification requirements

No runtime changes. The route stays at `-> dict:` with no `response_model`. The existing test (`test_returns_200_with_mapped_overview`) asserting V1-style keys (`ordersTotal`, `inboundOpen`, `binUtilPct`) continues to pass.

---

## What Databricks verification must establish

Before Option A can be safely implemented, the following must be confirmed:

1. **`DESCRIBE TABLE {catalog}.{schema}.wh360_kpi_snapshot_v`** — establish full column list. Confirm whether the following columns exist:
   - `inbound_due_count`
   - `inbound_overdue_count`
   - `outbound_due_count`
   - `outbound_overdue_count`
   - `staging_open_count`
   - `staging_overdue_count`
   - `near_expiry_count`
   - `reconciliation_exception_count`
   - `blocked_stock_count`
   - `plant_id`

2. **If the columns exist**: rewrite the SQL to select them; rewrite `map_warehouse_overview_rows` to emit the contract shape; add `plantId` to the output; add `response_model=Warehouse360Overview` to the route. Update `test_warehouse360_routes.py`.

3. **If some columns are missing**: document which are absent; raise with data platform to extend `wh360_kpi_snapshot_v` or introduce a new view; do not wire `response_model` until all required fields are present.

4. **Regardless**: confirm whether `plant_id` can be used to filter the view (if it exists), or whether the view is truly a global single-warehouse aggregate and `plantId` must come from the request parameter.

---

## Impact on existing tests

`apps/api/tests/routes/test_warehouse360_routes.py` — `test_returns_200_with_mapped_overview` asserts V1-style keys (`ordersTotal`, `inboundOpen`, `binUtilPct`). This test must be updated (not deleted) when the mapper is rewritten, replacing the V1 key assertions with contract-shape assertions (`inboundDueCount`, `outboundDueCount`, etc.).

Until then, the test correctly documents the current behaviour.

---

## Summary

| Item | Status |
|---|---|
| Contract fields (`Warehouse360OverviewSchema`) | 13 fields documented |
| Current mapper output fields | 12 V1-style KPI fields — completely different shape |
| Fields safely mappable without Databricks | 1 (`warehouseId` from request param) |
| Fields requiring Databricks verification | 11 (`plantId` + 9 count fields + `blockedStockCount`) |
| Silent semantic mismatches blocked | 2 (`inbound_open` ≠ `inboundDueCount`; `bins_blocked` ≠ `blockedStockCount`) |
| Frontend adapter expectation | Already expects contract shape; silently returns 0 for all counts |
| No local native KPI schema to promote | Confirmed — different from EnvMon case |
| `response_model` safe to add now? | **No** |
| Implementation requires Databricks access? | **Yes** |
| Recommended option | **C** — keep route unenforced; commit analysis; verify `wh360_kpi_snapshot_v` columns before rewriting mapper |
