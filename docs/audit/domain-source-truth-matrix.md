# Domain Source Truth Matrix

**Date:** 2026-05-17  
**Scope:** All 10 domain-integration adapter domains — per-domain data source status  
**Detail:** Per-method breakdown → see `docs/audit/adapter-source-status-matrix.md`  
**Reference:** `docs/audit/current-state-after-native-databricks-work.md`, ADR-024

---

## Legend

| Symbol | Meaning |
|---|---|
| ✓ BV | Browser-verified — real data confirmed in UAT |
| ✓ E | Executable — DDL confirmed, route wired, tests passing; browser verification pending |
| ✓ QS | QuerySpec written — adapter exists; route NOT wired; DDL partially verified |
| ✓ W | Route wired (proxy or native) — NOT browser-verified |
| Mock | Mock adapter only — no FastAPI route, no real data |
| Blocked | Cannot implement — missing view, missing infra, or missing business rules |

---

## Domain Matrix

### 1. Process Order History (POH)

**Adapter:** `domain-integrations/operations/src/adapters/process-order-review-adapter.ts`  
**FastAPI:** `apps/api/routes/process_order.py`  
**Databricks catalog:** `connected_plant_uat.csm_process_order_history`  
**ADR-024 priority:** 1

| Method | Source | Status |
|---|---|---|
| `getProcessOrderHeader` | `vw_gold_process_order` | ✓ BV 2026-05-17 |
| `getOrderOperations` | `vw_gold_process_order_phase` | ✓ BV 2026-05-17 |
| `getOrderConfirmations` | `vw_gold_confirmation` | ✓ E (DDL confirmed 2026-05-17) |
| `getOrderGoodsMovements` | `vw_gold_adp_movement` | ✓ E (DDL confirmed 2026-05-17) |
| `getProcessOrderReviewContext` | — | Mock |
| `getOrderProgressSummary` | — | Mock |
| `getExecutionTimeline` | — | Mock |
| `getOrderQualityContext` | — | Mock |
| `getOrderStagingContext` | — | Mock |
| `getRelatedBatchContext` | — | Mock |

**Total: 10 methods — 2 BV, 2 E, 6 mock**

---

### 2. Operations Plan Risk

**Adapter:** `domain-integrations/operations/src/adapters/operations-plan-risk-adapter.ts`  
**FastAPI:** None  
**Databricks views:** Unconfirmed — planning-data gold views required  
**ADR-024 priority:** Deferred (planning data)

| Method | Source | Status |
|---|---|---|
| `getOperationsPlanRiskContext` | — | Mock |
| `getPlanRiskSummary` | — | Mock |
| `getLateOrders` | — | Mock |
| `getMaterialShortages` | — | Mock |
| `getLineStatus` | — | Mock |
| `getScheduleAdherenceSummary` | — | Mock |
| `getYieldVarianceSummary` | `metric_yield_daily` (candidate) | Mock — view exists but DDL not run |
| `getShiftHandoverItems` | — | Mock |
| `getOperationsActionQueue` | — | Mock |

**Total: 9 methods — all mock**

---

### 3. Trace Investigation (Trace2)

**Adapter:** `domain-integrations/traceability/src/adapters/trace2-adapter.ts`  
**FastAPI:** `apps/api/routes/trace2.py`  
**Databricks adapter:** `apps/api/adapters/trace2/trace2_databricks_adapter.py`  
**Databricks catalog:** `connected_plant_uat.gold`  
**ADR-024 priority:** 2

| Method | Source | Status |
|---|---|---|
| `getBatchHeaderSummary` | `gold_batch_stock_v` + `gold_batch_summary_v`⚠ + `gold_material`⚠ + `gold_plant` | ✓ QS — DDL blockers (6 TODOs); V1 proxy returns 503 |
| `getTraceGraph` | `gold_batch_lineage` + `gold_material`⚠ + `gold_plant` | ✓ QS — language_id blocker |
| `getMassBalanceSummary` | `gold_batch_mass_balance_v`⚠ | ✓ QS — WHERE columns unverified |
| `getInvestigationContext` | — | Mock |
| `getCustomerExposureSummary` | Unknown | Blocked — business rules undefined |
| `getSupplierExposureSummary` | — | Mock |
| `getEventTimeline` | — | Mock |
| `getCoAReleaseStatus` | — | Mock |
| `getRiskSignals` | — | Mock |
| `getRelatedInvestigations` | — | Mock |
| `getTraceExposureForRelease` | — | Mock |

**Total: 11 methods — 3 QS (blocked on DDL), 1 blocked (business rules), 7 mock**

---

### 4. SPC Monitoring

**Adapter:** `domain-integrations/spc/src/adapters/spc-monitoring-adapter.ts`, `spc-signals-adapter.ts`  
**FastAPI:** None  
**Databricks MVs:** `spc_correlation_source_mv`, `spc_material_dim_mv`, `spc_plant_material_dim_mv`, `spc_process_flow_source_mv` (all exist; DDL not run)  
**ADR-024 priority:** 3

| Method | Source | Status |
|---|---|---|
| `getSPCMonitoringContext` | — | Mock |
| `getSPCSummary` | — | Mock |
| `getActiveSPCSignals` | — | Mock |
| `getMonitoredCharacteristics` | — | Mock |
| `getControlChartSeries` | `spc_correlation_source_mv` | Mock — MV exists; DDL not run |
| `getCharacteristicCapability` | — | Mock |
| `getSPCAlarmHistory` | — | Mock |
| `getSPCRelatedBatches` | — | Mock |
| `getSPCSignals` | — | Mock |

**Total: 9 methods — all mock**

---

### 5. Warehouse 360 (WH360)

**Adapter:** `domain-integrations/warehouse/src/adapters/warehouse-360-adapter.ts`  
**FastAPI:** `apps/api/routes/warehouse360.py`  
**Databricks views:** `wh360.imwm_stock_v`, `wh360.imwm_exceptions_v`, `wh360.imwm_stock_comparison_v`  
**ADR-024 priority:** 6 (last)  
**Infrastructure gap:** `QueryExecutor` requires `catalog_override` for `wh360` schema

| Method | Source | Status |
|---|---|---|
| `getWarehouse360Summary` | V1 proxy | ✓ W — not BV; V1 STOPPED → 503 |
| `getWarehouse360Context` | — | Mock |
| `getStockOverview` | `wh360.imwm_stock_v` | Mock |
| `getOpenHolds` | — | Mock |
| `getGoodsMovements` | — | Mock |
| `getReplenishmentNeeds` | — | Mock |
| `getLocationCapacities` | — | Mock |
| `getNearExpiryStock` | — | Mock |
| `getWarehouseExceptions` | `wh360.imwm_exceptions_v` | Mock |

**Total: 9 methods — 1 wired (not BV), 8 mock**

---

### 6. Connected Quality Lab (CQ Lab)

**Adapter:** `domain-integrations/quality/src/adapters/connected-quality-lab-adapter.ts`  
**FastAPI:** `apps/api/routes/connected_quality_lab.py`  
**Databricks catalog:** `connected_plant_uat.gold`  
**ADR-024 priority:** 4

| Method | Source | Status |
|---|---|---|
| `getLabPlants` | `gold.gold_plant` | ✓ BV 2026-05-17 |
| `getLabFailures` | `vw_gold_process_order_plan` ❌ | Blocked — view does not exist; V1 proxy returns 503 |

**Total: 2 methods — 1 BV, 1 blocked**

---

### 7. Environmental Monitoring (EnvMon)

**Adapter:** `domain-integrations/envmon/src/adapters/envmon-adapter.ts`  
**FastAPI:** None  
**Databricks views:** None confirmed  
**ADR-024 priority:** Not assigned

| Method | Source | Status |
|---|---|---|
| `getEnvMonContext` | — | Mock |
| `getEnvMonSiteSummary` | — | Mock |
| `getEnvMonZones` | — | Mock |
| `getEnvMonAlerts` | — | Mock |
| `getEnvMonSwabResults` | — | Mock |
| `getEnvMonTrends` | — | Mock |
| `getEnvMonHeatmap` | — | Mock |
| `getEnvMonCorrectiveActions` | — | Mock |
| `getEnvMonSwabVectors` | — | Mock |

**Total: 9 methods — all mock**  
**Status:** No gold views confirmed. No planning path identified. Requires domain owner to identify Databricks source.

**Groundwork docs (i.txt, 2026-05-17):** `docs/migration/envmon-native-groundwork-plan.md` · `docs/audit/envmon-contract-inventory.md` · `docs/audit/envmon-databricks-source-candidates.md` · `docs/audit/envmon-native-column-verification-checklist.md` · `docs/migration/envmon-native-candidate-ranking.md`

---

### 8. Maintenance and Reliability

**Adapter:** `domain-integrations/maintenance/src/adapters/maintenance-reliability-adapter.ts`  
**FastAPI:** None  
**Databricks views:** None confirmed  
**ADR-024 priority:** Not assigned

| Method | Source | Status |
|---|---|---|
| `getMaintenanceReliabilityContext` | — | Mock |
| `getMaintenanceKpiSummary` | — | Mock |
| `getWorkOrders` | — | Mock |
| `getPreventiveMaintenanceTasks` | — | Mock |
| `getEquipmentAvailability` | — | Mock |
| `getReliabilityMetrics` | — | Mock |
| `getMaintenanceBacklog` | — | Mock |

**Total: 7 methods — all mock**  
**Status:** No gold views confirmed. Requires domain owner to identify EAM/maintenance data source.

---

### 9. Production Staging

**Adapter:** `domain-integrations/warehouse/src/adapters/production-staging-adapter.ts`  
**FastAPI:** None  
**Databricks views:** None confirmed  
**ADR-024 priority:** Not assigned

| Method | Source | Status |
|---|---|---|
| `getProductionStagingContext` | — | Mock |
| `getStagingReadinessSummary` | — | Mock |
| `getStagingOrderSummaries` | — | Mock |
| `getStagingPickTasks` | — | Mock |
| `getStagingZoneCapacity` | — | Mock |
| `getStagingShortfalls` | — | Mock |
| `getStagingMoveRequests` | — | Mock |
| `getStagingPickingWaves` | — | Mock |
| `getStagingAlerts` | — | Mock |

**Total: 9 methods — all mock**  
**Status:** No warehouse staging views confirmed. Requires data engineering to confirm WMS gold views.

---

### 10. Quality Batch Release

**Adapter:** `domain-integrations/quality/src/adapters/quality-release-adapter.ts`  
**FastAPI:** None  
**Databricks views:** None confirmed  
**ADR-024 priority:** Not assigned

| Method | Source | Status |
|---|---|---|
| `getReleaseContext` | — | Mock |
| `getReleaseQueue` | — | Mock |
| `getReleaseSummary` | — | Mock |
| `getQualityResults` | — | Mock |
| `getCoAReadiness` | — | Mock |
| `getDeviations` | — | Mock |
| `getDecisionHistory` | — | Mock |

**Total: 7 methods — all mock**  
**Status:** No release management views confirmed. Business rules (severity thresholds, release criteria) are undefined.

---

## Summary

| Domain | Total | BV | E | QS | W | Mock | Blocked |
|---|---|---|---|---|---|---|---|
| POH | 10 | 2 | 2 | 0 | 0 | 6 | 0 |
| Ops Plan Risk | 9 | 0 | 0 | 0 | 0 | 9 | 0 |
| Trace | 11 | 0 | 0 | 3 | 0 | 7 | 1 |
| SPC | 9 | 0 | 0 | 0 | 0 | 9 | 0 |
| WH360 | 9 | 0 | 0 | 0 | 1 | 8 | 0 |
| CQ Lab | 2 | 1 | 0 | 0 | 0 | 0 | 1 |
| EnvMon | 9 | 0 | 0 | 0 | 0 | 9 | 0 |
| Maintenance | 7 | 0 | 0 | 0 | 0 | 7 | 0 |
| Prod Staging | 9 | 0 | 0 | 0 | 0 | 9 | 0 |
| Quality Release | 7 | 0 | 0 | 0 | 0 | 7 | 0 |
| **Total** | **82** | **3** | **2** | **3** | **1** | **71** | **2** |

**3 of 82 methods (3.7%) are browser-verified with live Databricks data (BV).**  
**2 of 82 methods (2.4%) are executable — databricks-api route wired, DDL confirmed, awaiting browser verification (E).**  
**1 of 82 methods (1.2%) has a legacy-api proxy wired but is not browser-verified (W).**  
**71 of 82 methods (86.6%) are mock-only — no wired route of any kind.**  
*(The remaining 5 methods: 3 have a databricks-api QuerySpec written but no route wired; 2 are blocked by missing view or undefined business rules.)*
