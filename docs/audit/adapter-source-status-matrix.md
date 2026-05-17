# Adapter Source Status Matrix

**Generated:** 2026-05-16  
**Last updated:** 2026-05-17 — databricks-api browser-verified for CQ plants + POH order header  
**Scope:** All domain-integration adapter methods across Trace2, SPC, Warehouse360, POH (Process Order Review), and Quality/Lab  
**Reference:** ADR-024 (`docs/adr/ADR-024-native-databricks-data-access-architecture.md`)

---

## UAT Deployment State (as of 2026-05-17)

| Item | Status |
|---|---|
| V2 app deployed to UAT | **RUNNING** — `https://connectio-v2-604667594731808.8.azure.databricksapps.com` |
| React UI load | Confirmed |
| `BACKEND_ADAPTER_MODE` | **`databricks-api`** — native Databricks reads active for CQ lab plants and POH order header |
| V1 apps | **STOPPED** — all legacy-api domain routes return 503 until V1 apps are restarted |
| Native Databricks reads | **Active and browser-verified** — `DATABRICKS_HOST`, `SQL_WAREHOUSE_ID`, `POH_CATALOG`, `CQ_CATALOG` set as literals in `app.yaml` |
| OAuth identity (`sql` scope) | **Confirmed** — `effective_user_api_scopes` includes `sql`; set via `user_api_scopes` in `databricks.yml` |
| CQ lab plants | **Browser-verified 2026-05-17** — `GET /api/cq/lab/plants` returns real plant list; `X-Data-Source: databricks-api` |
| POH order header | **Browser-verified 2026-05-17** — `POST /api/por/order-header` with process order 7006965038 returns real data |

> **Two-layer adapter model:** `VITE_ADAPTER_MODE=legacy-api` (baked into the frontend bundle) means the frontend calls FastAPI via HTTP — not mock. It is independent of `BACKEND_ADAPTER_MODE`. The frontend has no `databricks-api` mode; Databricks is always accessed through the FastAPI layer.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✓ | Implemented / available |
| ✓ BV | Implemented + browser-verified against live V1 |
| ✓ W | Wired (proxy route + adapter code exist) — NOT browser-verified |
| — | Not yet implemented |
| ⛔ | Blocked (prerequisite missing) |

**Source badge behaviour:**
- `mock`: no badge rendered
- `legacy-api`: amber badge in every panel consuming this data
- `databricks-api`: green badge (future)

---

## Traceability — `Trace2Adapter` / `Trace2LegacyApiAdapter`

Adapter class: `domain-integrations/traceability/src/adapters/trace2-adapter.ts`  
ADR-024 migration priority: **2** (after POH)  
Gold views: `gold_batch_material`, `gold_process_order`, `gold_adp_movement` (all available)

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getBatchHeaderSummary` | ✓ | ✓ BV | ✓ 2024-03-08 | — | amber when live | **First candidate for databricks-api** — lowest risk; verified leg-api exists for parallel validation |
| `getInvestigationContext` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getTraceGraph` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getMassBalanceSummary` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getCustomerExposureSummary` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getSupplierExposureSummary` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getEventTimeline` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getCoAReleaseStatus` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getRiskSignals` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getRelatedInvestigations` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getTraceExposureForRelease` | ✓ | — | — | — | none | Add to Trace databricks-api slice |

**Summary:** 11 methods — 1 browser-verified legacy-api, 10 mock only.

---

## SPC — `SPCMonitoringAdapter` / `SPCSignalsAdapter`

Adapter class: `domain-integrations/spc/src/adapters/spc-monitoring-adapter.ts`, `spc-signals-adapter.ts`  
ADR-024 migration priority: **3**  
Gold views: `spc_correlation_source_mv`, `spc_material_dim_mv`, `spc_plant_material_dim_mv`, `spc_process_flow_source_mv` (all MVs exist)

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getSPCMonitoringContext` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getSPCSummary` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getActiveSPCSignals` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getMonitoredCharacteristics` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getControlChartSeries` | ✓ | — | — | — | none | Backed by `spc_correlation_source_mv` |
| `getCharacteristicCapability` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getSPCAlarmHistory` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getSPCRelatedBatches` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getSPCSignals` | ✓ | — | — | — | none | Include in SPC databricks-api slice |

**Summary:** 9 methods — all mock only. No legacy-api adapter. Cannot validate against V1 via parallel testing. MV infrastructure already exists — databricks-api migration is primarily a QuerySpec wrapping exercise.

---

## Warehouse360 — `Warehouse360Adapter` / `Warehouse360LegacyApiAdapter`

Adapter class: `domain-integrations/warehouse/src/adapters/warehouse-360-adapter.ts`  
ADR-024 migration priority: **6** (last — highest complexity, separate schema)  
Gold views: `wh360.imwm_stock_v`, `wh360.imwm_exceptions_v`, `wh360.imwm_stock_comparison_v` (complex layered view stack)

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getWarehouse360Summary` | ✓ | ✓ W | — | — | amber when live | **Browser-verify first** before databricks-api |
| `getWarehouse360Context` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getStockOverview` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getOpenHolds` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getGoodsMovements` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getReplenishmentNeeds` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getLocationCapacities` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getNearExpiryStock` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getWarehouseExceptions` | ✓ | — | — | — | none | Backed by `wh360.imwm_exceptions_v` (7-UNION view) |

**Summary:** 9 methods — 1 wired legacy-api (not browser-verified), 8 mock only.  
**Risk note:** `wh360` uses a separate catalog schema. QueryExecutor `catalog_override` must be implemented before this module migrates.

---

## Process Order History — `ProcessOrderReviewAdapter` / `ProcessOrderReviewLegacyApiAdapter`

Adapter class: `domain-integrations/operations/src/adapters/process-order-review-adapter.ts`  
ADR-024 migration priority: **1** (first — high value, views available)  
Gold views: `vw_gold_order_summary`, `metric_yield_per_order`, `metric_yield_daily`, `vw_gold_day_view_blocks` (all available)

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getProcessOrderHeader` | ✓ | ✓ W | — | **✓ BV 2026-05-17** | green when databricks | Browser-verified: process order 7006965038 returned real data; some fields empty by design (not in view) |
| `getProcessOrderReviewContext` | ✓ | — | — | — | none | Include in POH databricks-api slice |
| `getOrderProgressSummary` | ✓ | — | — | — | none | Include in POH databricks-api slice |
| `getExecutionTimeline` | ✓ | — | — | — | none | Include in POH databricks-api slice |
| `getOrderQualityContext` | ✓ | — | — | — | none | Include in POH databricks-api slice |
| `getOrderStagingContext` | ✓ | — | — | — | none | Include in POH databricks-api slice |
| `getRelatedBatchContext` | ✓ | — | — | — | none | Include in POH databricks-api slice |
| `getOrderOperations` | ✓ | — | — | — | none | Maps to `vw_gold_process_order_phase` (AFPO) |
| `getOrderConfirmations` | ✓ | — | — | — | none | Maps to `vw_gold_confirmation` (AFVC/AFVV) |
| `getOrderGoodsMovements` | ✓ | — | — | — | none | Maps to `vw_gold_adp_movement` (MSEG 101/261) |

**POH (Plan Risk) — `OperationsPlanRiskAdapter`** (no legacy adapter):

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getOperationsPlanRiskContext` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getPlanRiskSummary` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getLateOrders` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getMaterialShortages` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getLineStatus` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getScheduleAdherenceSummary` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getYieldVarianceSummary` | ✓ | — | — | — | none | Could use `metric_yield_daily` |
| `getShiftHandoverItems` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getOperationsActionQueue` | ✓ | — | — | — | none | Requires planning-data gold views |

**Summary (POR):** 10 + 9 = 19 methods — 1 wired legacy-api (not browser-verified), 18 mock only.

---

## Quality / Lab — `ConnectedQualityLabAdapter` / `ConnectedQualityLabLegacyApiAdapter`

Adapter class: `domain-integrations/quality/src/adapters/connected-quality-lab-adapter.ts`  
ADR-024 migration priority: **4**  
Gold views: `vw_gold_quality_result_enriched`, `metric_quality_daily` (available); `vw_gold_process_order_plan` (**missing — blocker**)

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getLabFailures` | ✓ | ✓ W | — | — | amber when live | **Browser-verify** `GET /api/cq/lab/fails`. Databricks-api blocked on `vw_gold_process_order_plan` |
| `getLabPlants` | ✓ | ✓ W | — | **✓ BV 2026-05-17** | green when databricks | Browser-verified: `GET /api/cq/lab/plants` returns real plant list; `PLANT_ID`/`PLANT_NAME` column names confirmed |

**Summary:** 2 methods — both wired legacy-api (not browser-verified); `getLabPlants` also mode-gated for databricks-api.  
**Blocker:** `vw_gold_process_order_plan` does not exist. `getLabFailures` cannot migrate to databricks-api until this view is created. `getLabPlants` unblocked — column names must be confirmed.

---

## Cross-Domain Totals

| Domain | Total methods | Browser-verified (databricks-api) | Wired (not verified) | Mock only | Databricks-api (mode-gated) |
|--------|--------------|----------------------------------|---------------------|-----------|----------------|
| Traceability | 11 | 1 (legacy-api only) | 0 | 10 | 0 |
| SPC | 9 | 0 | 0 | 9 | 0 |
| Warehouse360 | 9 | 0 | 1 | 8 | 0 |
| POH (POR) | 10 | **1** (`getProcessOrderHeader` 2026-05-17) | 1 | 8 | **1 BV** |
| POH (plan risk) | 9 | 0 | 0 | 9 | 0 |
| Quality/Lab | 2 | **1** (`getLabPlants` 2026-05-17) | 1 | 0 | **1 BV** |
| **Total** | **50** | **2** | **3** | **44** | **2 BV** |

---

## FastAPI Route Inventory

| Route | Method | Domain | Adapter override | Status |
|-------|--------|--------|-----------------|--------|
| `/api/trace2/batch-header` | POST | Traceability | `getBatchHeaderSummary` | ✓ Browser-verified (V1 was live); UAT: returns 503 while V1 STOPPED |
| `/api/wh360/warehouse-summary` | POST | Warehouse360 | `getWarehouse360Summary` | Wired — not verified; UAT: 503 while V1 STOPPED |
| `/api/por/order-header` | POST | POH | `getProcessOrderHeader` | Wired (legacy-api) + databricks-api **browser-verified 2026-05-17** (process order 7006965038) |
| `/api/cq/lab/fails` | GET | Quality/Lab | `getLabFailures` | Wired (legacy-api only); databricks-api blocked on `vw_gold_process_order_plan` |
| `/api/cq/lab/plants` | GET | Quality/Lab | `getLabPlants` | Wired (legacy-api) + databricks-api **browser-verified 2026-05-17** |

No other domain-integration routes exist. Do not add routes without browser-verification against a live V1 backend.
