# Databricks Object Dependency Matrix

**Date:** 2026-05-17  
**Scope:** All Databricks views and materialised views referenced by current or planned native adapters  
**Catalog (default):** `connected_plant_uat`  
**Reference:** `docs/audit/adapter-source-status-matrix.md`, `docs/audit/current-state-after-native-databricks-work.md`

---

## Legend

| Symbol | Meaning |
|---|---|
| ✓ BV | Browser-verified — live data confirmed against this object |
| ✓ E | Executable — DDL confirmed, route wired, not yet browser-verified |
| ✓ QS | QuerySpec written — adapter and SQL exist; route not wired; DDL status varies |
| ⚠ | DDL partially confirmed — some columns verified, others TODO |
| ❌ | DDL not verified or object does not exist |
| P | Planned — referenced in architecture docs; no adapter yet |

---

## POH — `connected_plant_uat.csm_process_order_history`

| Object | Columns confirmed | Used by | Status |
|---|---|---|---|
| `vw_gold_process_order` | PROCESS_ORDER_ID, STATUS, MATERIAL_ID, INSPECTION_LOT_ID, MATERIAL_DESCRIPTION, PLANT_ID | `getProcessOrderHeader` | ✓ BV 2026-05-17 |
| `vw_gold_process_order_phase` | PROCESS_ORDER_PHASE_ID, PROCESS_ORDER_ID, PHASE_ID, PHASE_DESCRIPTION, PHASE_TEXT, START_USER, END_USER, OPERATION_QUANTITY, OPERATION_QUANTITY_UOM, SORT_NUMBER | `getOrderOperations` | ✓ BV 2026-05-17 |
| `vw_gold_confirmation` | CONFIRMATION_ID, PROCESS_ORDER_PHASE_ID, PROCESS_ORDER_ID, PHASE_ID, PLANT_ID, CONFIRMED_QUANTITY, CONFIRMED_QUANTITY_UOM, START_TIMESTAMP, END_TIMESTAMP, SET_UP_DURATION_S, MACHINE_DURATION_S, CLEANING_DURATION_S, GROSS_DURATION_S, `__BATCH_ID`, `__CREATED_ON`, `__UPDATED_ON` | `getOrderConfirmations` | ✓ E (DDL confirmed 2026-05-17) |
| `vw_gold_adp_movement` | ID, PROCESS_ORDER_ID, PHASE_ID, QUANTITY, UOM, PLANT_ID, MATERIAL_ID, MOVEMENT_TYPE, BATCH_ID, USER, DATE_TIME_OF_ENTRY, MATERIAL_DOCUMENT, STORAGE_ID (+ 25 more) | `getOrderGoodsMovements` | ✓ E (DDL confirmed 2026-05-17) |
| `vw_gold_process_order_plan` | Unknown | `getLabFailures` | ❌ **Object does not exist** — CQ lab fails blocked |
| `metric_yield_per_order` | Unknown | Planned (POH yield) | P |
| `metric_yield_daily` | Unknown | Planned (plan risk yield variance) | P |

**Missing fields from confirmed views:**
- `vw_gold_process_order`: quantities, dates, batchId, productionLine, orderType — not in view
- `vw_gold_process_order_phase`: dates, durations, workCentre, resource — not in view
- `vw_gold_confirmation`: operationText, isFinalConfirmation — not in view
- `vw_gold_adp_movement`: materialDescription — no material master join

---

## CQ Lab — `connected_plant_uat.gold`

| Object | Columns confirmed | Used by | Status |
|---|---|---|---|
| `gold_plant` | PLANT_ID, PLANT_NAME | `getLabPlants` | ✓ BV 2026-05-17 |
| `vw_gold_quality_result_enriched` | Unknown | Planned (CQ quality results) | P |
| `metric_quality_daily` | Unknown | Planned (CQ daily metrics) | P |

---

## Trace — `connected_plant_uat.gold`

| Object | Columns confirmed | Used by | Status |
|---|---|---|---|
| `gold_batch_stock_v` | material_id, batch_id, unrestricted, blocked, quality_inspection, restricted, transit, total_stock | `getBatchHeaderSummary` (join) | ✓ QS (columns confirmed from V1 inspection) |
| `gold_batch_lineage` | parent_material_id, parent_batch_id, parent_plant_id, child_material_id, child_batch_id, child_plant_id, link_type | `getTraceGraph` | ✓ QS (columns confirmed from V1 inspection) |
| `gold_batch_summary_v` | **NOT VERIFIED** — 6 columns assumed: plant_id, manufacture_date, expiry_date, batch_status, uom, process_order_id | `getBatchHeaderSummary` | ⚠ DDL NOT run — **blocks route wiring** |
| `gold_material` | material_id, material_name confirmed; `language_id` **NOT VERIFIED** | `getBatchHeaderSummary`, `getTraceGraph` | ⚠ language_id unverified — **blocks route wiring** |
| `gold_plant` | plant_id, plant_name (assumed — confirmed for CQ lab, assumed same view) | `getBatchHeaderSummary`, `getTraceGraph` | ✓ QS (assumed; LEFT JOIN so not hard-blocking) |
| `gold_batch_mass_balance_v` | SELECT columns confirmed (posting_date, movement_type, movement_category, abs_quantity, uom, balance_qty); WHERE columns NOT VERIFIED (material_id, batch_id assumed) | `getMassBalanceSummary` | ⚠ WHERE columns NOT verified — **blocks route wiring** |

---

## SPC — `connected_plant_uat` (schema TBC)

All SPC objects are planned only — no adapter or routes exist.

| Object | Used by (planned) | Status |
|---|---|---|
| `spc_correlation_source_mv` | `getControlChartSeries` | P — MV confirmed to exist; catalog/schema unconfirmed |
| `spc_material_dim_mv` | `getSPCMonitoringContext`, `getSPCSummary` | P — MV confirmed to exist |
| `spc_plant_material_dim_mv` | `getMonitoredCharacteristics` | P — MV confirmed to exist |
| `spc_process_flow_source_mv` | SPC process flow methods | P — MV confirmed to exist |

---

## WH360 — separate catalog schema

All WH360 objects are planned only. The schema (`wh360`) is separate from `gold` and `csm_process_order_history` and requires a `catalog_override` implementation in `QueryExecutor` before use.

| Object | Used by (planned) | Status |
|---|---|---|
| `wh360.imwm_stock_v` | `getStockOverview`, `getNearExpiryStock` | P — catalog/schema unconfirmed for UC |
| `wh360.imwm_exceptions_v` | `getWarehouseExceptions` | P — 7-UNION view, complex |
| `wh360.imwm_stock_comparison_v` | WH360 comparison methods | P |

**Additional blocker:** `QueryExecutor` does not support `catalog_override` for alternate schemas. This must be implemented before any WH360 native route can be wired.

---

## EnvMon — No objects identified

**Groundwork date:** 2026-05-17 (i.txt)
**Source system:** LIMS
**Catalog:** Unknown — no EnvMon gold views found in this repo or in Unity Catalog docs

Zero Databricks objects have been identified for EnvMon. The candidates in `docs/audit/envmon-databricks-source-candidates.md` are entirely speculative — none are confirmed by DDL. No objects can be added to this matrix until the domain owner identifies the source views.

| Object | Used by | Status |
|---|---|---|
| (none identified) | — | Domain owner must name source views before DDL verification |

**Next action:** Run exploratory `SHOW TABLES IN connected_plant_uat.<schema>` after domain owner identifies the relevant schema. Then run `DESCRIBE TABLE` on each candidate and add confirmed objects to this section.

---

## DDL Verification Queue

Items that must be manually verified in Databricks before routes can be wired:

| Object | SQL to run | Blocking |
|---|---|---|
| `gold_batch_summary_v` | `DESCRIBE TABLE connected_plant_uat.gold.gold_batch_summary_v;` | `getBatchHeaderSummary` |
| `gold_material.language_id` | `SELECT DISTINCT language_id FROM connected_plant_uat.gold.gold_material LIMIT 20;` | `getBatchHeaderSummary`, `getTraceGraph` |
| `gold_batch_mass_balance_v` WHERE cols | `DESCRIBE TABLE connected_plant_uat.gold.gold_batch_mass_balance_v;` | `getMassBalanceSummary` |

Full DDL checklist: `docs/audit/trace-native-column-verification-checklist.md`

---

## Object → Adapter Cross-Reference

| Adapter method | Databricks objects | Route status |
|---|---|---|
| `getLabPlants` | `gold.gold_plant` | ✓ BV |
| `getProcessOrderHeader` | `csm_process_order_history.vw_gold_process_order` | ✓ BV |
| `getOrderOperations` | `csm_process_order_history.vw_gold_process_order_phase` | ✓ BV |
| `getOrderConfirmations` | `csm_process_order_history.vw_gold_confirmation` | ✓ E |
| `getOrderGoodsMovements` | `csm_process_order_history.vw_gold_adp_movement` | ✓ E |
| `getBatchHeaderSummary` | `gold.gold_batch_stock_v`, `gold.gold_batch_summary_v`⚠, `gold.gold_material`⚠, `gold.gold_plant` | QS only — blocked |
| `getTraceGraph` | `gold.gold_batch_lineage`, `gold.gold_material`⚠, `gold.gold_plant` | QS only — blocked |
| `getMassBalanceSummary` | `gold.gold_batch_mass_balance_v`⚠ | QS only — blocked |
| `getLabFailures` | `csm_process_order_history.vw_gold_process_order_plan`❌ | Blocked — view missing |
| All other methods (74) | None — mock data | Mock only |
